export interface SparkLiteEvent {
  eventName: string;
  listener: (
    data: any,
    callback?: (result: any) => void
  ) => Promise<void> | void;
}
