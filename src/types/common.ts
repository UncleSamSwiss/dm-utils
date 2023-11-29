export type ApiVersion = "v1";

export type DeviceStatus =
    | "connected"
    | "disconnected"
    | {
          /**
           * This can either be the name of a font awesome icon (e.g. "fa-signal") or the URL to an icon.
           */
          icon: string;
          description?: ioBroker.StringOrTranslated;
      };

export type DeviceRefresh = "device" | "instance" | false | true;

export type RefreshResponse = {
    refresh: DeviceRefresh;
};

export type ErrorResponse = {
    error: {
        code: number;
        message: string;
    };
};

export type RetVal<T> = T | Promise<T>;

export type JsonFormSchema = Record<string, any>; // TODO: make this better typed

export type JsonFormData = Record<string, any>;

export interface DeviceDetails {
    id: string;
    schema: JsonFormSchema;
    data?: JsonFormData;
}
