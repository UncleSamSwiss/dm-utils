/// <reference types="iobroker" />
export declare type ApiVersion = "v1";
export declare type DeviceStatus = "connected" | "disconnected" | {
    /**
     * This can either be the name of a font awesome icon (e.g. "fa-signal") or the URL to an icon.
     */
    icon: string;
    description?: ioBroker.StringOrTranslated;
};
export declare type DeviceRefresh = "device" | "instance" | false;
export declare type RetVal<T> = T | Promise<T>;
export declare type JsonFormSchema = Record<string, any>;
export declare type JsonFormData = Record<string, any>;
export interface DeviceDetails {
    id: string;
    schema: JsonFormSchema;
    data?: JsonFormData;
}
