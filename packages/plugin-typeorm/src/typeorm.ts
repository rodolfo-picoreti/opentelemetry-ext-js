import { BasePlugin } from '@opentelemetry/core';
import { Span, CanonicalCode, SpanKind } from '@opentelemetry/api';
import { DatabaseAttribute, GeneralAttribute } from '@opentelemetry/semantic-conventions';
import { TypeormPluginConfig } from './types';
import { safeExecute, getParamNames } from './utils';
import shimmer from 'shimmer';
import { VERSION } from './version';
import * as typeorm from 'typeorm';

class TypeormPlugin extends BasePlugin<typeof typeorm> {
    protected _config!: TypeormPluginConfig;

    constructor(readonly moduleName: string) {
        super(`opentelemetry-plugin-typeorm`, VERSION);
    }

    protected patch(): typeof typeorm {
        this._logger.debug(`applying patch to ${this.moduleName}@${this.version}`);
        shimmer.wrap(
            this._moduleExports.ConnectionManager.prototype,
            'create',
            this._createConnectionManagerPatch.bind(this)
        );

        return this._moduleExports;
    }
    protected unpatch(): void {
        shimmer.unwrap(this._moduleExports.ConnectionManager.prototype, 'create');
    }

    private _createConnectionManagerPatch(original: (options: typeorm.ConnectionOptions) => typeorm.Connection) {
        const thisPlugin = this;
        return function (options: typeorm.ConnectionOptions) {
            const connection: typeorm.Connection = original.apply(this, arguments);

            // Both types using same patch right now, keep different declarations for future improvements
            const functionsUsingEntityPersistExecutor = ['save', 'remove', 'softRemove', 'recover'];
            const functionsUsingQueryBuilder = [
                'insert',
                'update',
                'delete',
                'softDelete',
                'restore',
                'count',
                'find',
                'findAndCount',
                'findByIds',
                'findOne',
                'increment',
                'decrement',
            ];

            const patch = (operation: string) => {
                if (connection.manager[operation])
                    shimmer.wrap(
                        connection.manager,
                        operation as keyof typeorm.EntityManager,
                        thisPlugin._getEntityManagerFunctionPatch(operation).bind(thisPlugin)
                    );
            };

            functionsUsingEntityPersistExecutor.forEach(patch);
            functionsUsingQueryBuilder.forEach(patch);

            return connection;
        };
    }

    private _getEntityManagerFunctionPatch(opName: string) {
        const thisPlugin = this;
        thisPlugin._logger.debug(`TypeormPlugin: patched EntityManager ${opName} prototype`);
        return function (original: Function) {
            return async function (...args: any[]) {
                const connectionOptions = this?.connection?.options ?? {};
                const attributes = {
                    [DatabaseAttribute.DB_SYSTEM]: connectionOptions.type,
                    [DatabaseAttribute.DB_USER]: connectionOptions.username,
                    // [GeneralAttribute.NET_PEER_IP]: '?',
                    [GeneralAttribute.NET_PEER_NAME]: connectionOptions.host,
                    [GeneralAttribute.NET_PEER_PORT]: connectionOptions.port,
                    // [GeneralAttribute.NET_TRANSPORT]: '?',
                    [DatabaseAttribute.DB_NAME]: connectionOptions.database,
                    [DatabaseAttribute.DB_OPERATION]: opName,
                    [DatabaseAttribute.DB_STATEMENT]: JSON.stringify(buildStatement(original, args)),
                    component: 'typeorm',
                };

                Object.entries(attributes).forEach(([key, value]) => {
                    if (value === undefined) delete attributes[key];
                });

                const newSpan: Span = thisPlugin._tracer.startSpan(`TypeORM ${opName}`, {
                    kind: SpanKind.CLIENT,
                    attributes,
                });

                try {
                    const response: Promise<any> = thisPlugin._tracer.withSpan(newSpan, () =>
                        original.apply(this, arguments)
                    );
                    const resolved = await response;
                    if (thisPlugin._config?.responseHook) {
                        safeExecute([], () => thisPlugin._config.responseHook(newSpan, resolved), false, thisPlugin._logger);
                    }
                    return resolved;
                } catch (err) {
                    newSpan.setStatus({
                        code: CanonicalCode.UNKNOWN,
                        message: err.message,
                    });
                    throw err;
                } finally {
                    newSpan.end();
                }
            };
        };
    }
}

const buildStatement = (func: Function, args: any[]) => {
    const paramNames = getParamNames(func);
    const statement = {};
    paramNames.forEach((pName, i) => {
        const value = args[i];
        if (!value) return;

        try {
            const stringified = JSON.stringify(value);
            if (stringified) {
                statement[pName] = args[i];
                return;
            }
        } catch (err) {}
        if (value?.name) {
            statement[pName] = value.name;
            return;
        }
        if (value?.constructor?.name) {
            statement[pName] = value.constructor.name;
        }
    });
    return statement;
};

export const plugin = new TypeormPlugin('typeorm');
