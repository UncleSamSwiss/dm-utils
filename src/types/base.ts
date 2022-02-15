import { ActionContext } from "..";
import { ApiVersion, DeviceRefresh, DeviceStatus, RetVal } from "./common";

type ActionType = "api" | "adapter";

export interface ActionBase<T extends ActionType> {
	id: string;
	/**
	 * This can either be the name of a font awesome icon (e.g. "fa-signal") or the URL to an icon.
	 */
	icon: string;
	description?: ioBroker.StringOrTranslated;
	disabled?: T extends "api" ? boolean : never;
}

export interface InstanceAction<T extends ActionType = "api"> extends ActionBase<T> {
	handler?: T extends "api" ? never : (context: ActionContext) => RetVal<{ refresh: boolean }>;
	title: string;
}

export interface DeviceAction<T extends ActionType = "api"> extends ActionBase<T> {
	handler?: T extends "api"
		? never
		: (deviceId: string, context: ActionContext) => RetVal<{ refresh: DeviceRefresh }>;
}

export interface InstanceDetails<T extends ActionType = "api"> {
	apiVersion: ApiVersion;
	actions?: InstanceAction<T>[];
}

export interface DeviceInfo<T extends ActionType = "api"> {
	id: string;
	name: ioBroker.StringOrTranslated;
	status?: DeviceStatus;
	actions?: DeviceAction<T>[];
	hasDetails?: boolean;
}
