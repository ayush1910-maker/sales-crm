export class ApiResponse {
  constructor(statusCode, data, message = 'Success', meta = undefined) {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.data = data;
    this.message = message;
    if (meta !== undefined) {
      this.meta = meta;
    }
  }

  static ok(data, message = 'OK', meta = undefined) {
    return new ApiResponse(200, data, message, meta);
  }

  static created(data, message = 'Created', meta = undefined) {
    return new ApiResponse(201, data, message, meta);
  }
}
