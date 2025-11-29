class ErrorResponse extends Error {
  constructor(message, statusCode, success, error) {
    super(message);
    this.status = statusCode;
    this.success = success;
    this.errors = error;
    this.timestamp = new Date();
  }
}

module.exports = ErrorResponse;
