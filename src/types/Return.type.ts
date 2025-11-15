export interface ReturnTemplate {
  status: "Success" | "Failed";
  message: string | null;
  error: Error | string | null;
  data?: any;
}
