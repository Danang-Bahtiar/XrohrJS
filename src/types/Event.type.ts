export interface SparkLiteEvent {
    eventName: string;
    listener: (...args: any[]) => Promise<void>;
}