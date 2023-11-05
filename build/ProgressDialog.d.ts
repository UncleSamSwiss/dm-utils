/// <reference types="iobroker" />
export interface ProgressDialog {
    update(update: {
        title?: ioBroker.StringOrTranslated;
        indeterminate?: boolean;
        value?: number;
        label?: ioBroker.StringOrTranslated;
    }): Promise<void>;
    close(): Promise<void>;
}
