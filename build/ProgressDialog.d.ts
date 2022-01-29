export interface ProgressDialog {
    update(update: {
        title?: string;
        indeterminate?: boolean;
        value?: number;
        label?: string;
    }): Promise<void>;
    close(): Promise<void>;
}
