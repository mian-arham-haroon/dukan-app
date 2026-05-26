declare const __DEV__: boolean;

export const IS_DEV_TOOLS_ENABLED =
  typeof __DEV__ !== "undefined"
    ? __DEV__
    : process.env.NODE_ENV !== "production";
