class ErrorWithCode extends Error {
  errorCode?: number;
  constructor(message: string, errorCode?: number) {
    super(message);
    this.name = "ErrorWithCode";
    this.errorCode = errorCode;
  }
}

export type TErrorWithCode = typeof ErrorWithCode;
export default ErrorWithCode;
