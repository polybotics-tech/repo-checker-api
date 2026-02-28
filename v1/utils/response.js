export function SuccessResponse(
  response = {},
  { statusCode = 200, message = "Request successful", data = {} },
) {
  return response
    .status(statusCode)
    .json({
      success: true,
      message,
      data,
    })
    .end();
}

export function FailedResponse(
  response = {},
  { statusCode = 500, message = "Internal server error", data = {} },
) {
  return response
    .status(statusCode)
    .json({
      success: false,
      message,
      data,
    })
    .end();
}
