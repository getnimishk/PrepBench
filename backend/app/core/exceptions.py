from fastapi import HTTPException, status

class ExamSimulatorException(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(self.message)

class ResourceNotFoundException(HTTPException):
    def __init__(self, resource_name: str, resource_id: str | int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource_name} with ID '{resource_id}' not found."
        )

class InvalidExamStateException(HTTPException):
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )

class ImportValidationException(HTTPException):
    def __init__(self, detail: str, errors: list = None):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": detail, "errors": errors or []}
        )
