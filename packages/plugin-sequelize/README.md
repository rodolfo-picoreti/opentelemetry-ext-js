# OpenTelemetry Sequelize Instrumentation for Node.js
[![NPM version](https://img.shields.io/npm/v/opentelemetry-plugin-sequelize.svg)](https://www.npmjs.com/package/opentelemetry-plugin-sequelize)

This module provides automatic instrumentation for [`Sequelize`](https://sequelize.org/).  
> _Tested and worked on versions v4, v5 and v6 of Sequelize._

## Installation

```
npm install --save opentelemetry-plugin-sequelize
```

## Usage

To load a specific plugin (**sequelize** in this case), specify it in the Node Tracer's configuration

```js
const { NodeTracerProvider } = require("@opentelemetry/node");

const provider = new NodeTracerProvider({
  plugins: {
    sequelize: {
      enabled: true,
      // You may use a package name or absolute path to the file.
      path: "opentelemetry-plugin-sequelize",
    },
  },
});
```

### Sequelize Plugin Options

Sequelize plugin has few options available to choose from. You can set the following:

| Options        | Type                                   | Description                                                                                     |
| -------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `responseHook` | `SequelizeResponseCustomAttributesFunction` | Hook called before response is returned, which allows to add custom attributes to span.      |
| `ignoreOrphanedSpans` | `boolean` | Set to true if you only want to trace operation which has parent spans |

---

This extension (and many others) was developed by [Aspecto](https://www.aspecto.io/) with ❤️
