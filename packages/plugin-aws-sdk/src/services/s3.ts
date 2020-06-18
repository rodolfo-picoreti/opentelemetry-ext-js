import { Attributes } from "@opentelemetry/api";
import { RequestMetadata } from "./service-attributes";

export function getS3RequestSpanAttributes(
  request: AWS.Request<any, any>
): RequestMetadata {
  return {
    attributes: {},
    isIncoming: false,
  };
}

export function getS3ResponseSpanAttributes(
  response: AWS.Response<any, any>
): Attributes {
  return {};
}
