import { AdapterInstance } from "@iobroker/adapter-core";
import { ActionContext } from "./ActionContext";
import { DeviceDetails, DeviceInfo, ErrorResponse, InstanceDetails, RefreshResponse, RetVal } from "./types";
export declare abstract class DeviceManagement<T extends AdapterInstance = AdapterInstance> {
    protected readonly adapter: T;
    private instanceInfo?;
    private devices?;
    private readonly contexts;
    constructor(adapter: T);
    protected get log(): ioBroker.Log;
    protected getInstanceInfo(): RetVal<InstanceDetails>;
    protected abstract listDevices(): RetVal<DeviceInfo[]>;
    protected getDeviceDetails(id: string): RetVal<DeviceDetails | null | {
        error: string;
    }>;
    protected handleInstanceAction(actionId: string, context: ActionContext): RetVal<ErrorResponse> | RetVal<RefreshResponse>;
    protected handleDeviceAction(deviceId: string, actionId: string, context: ActionContext): RetVal<ErrorResponse> | RetVal<RefreshResponse>;
    private onMessage;
    private handleMessage;
    private convertActions;
    private sendReply;
}
