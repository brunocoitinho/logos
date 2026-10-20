"""Erros da aplicação e handlers que garantem um formato único de resposta de erro:

    {"error": {"code": "CONFLICT", "message": "...", "details": {...}}}

O front trata todos os erros da mesma forma, e nenhum detalhe interno (stack trace,
SQL) chega ao cliente.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import InterfaceError, OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("logos")


class AppError(Exception):
    status_code = 400
    code = "BAD_REQUEST"

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.details = details
        self.headers = headers


class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHORIZED"

    def __init__(self, message: str = "Sessão inválida ou expirada. Faça login novamente.") -> None:
        super().__init__(message, headers={"WWW-Authenticate": "Bearer"})


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"


class TooManyRequestsError(AppError):
    status_code = 429
    code = "TOO_MANY_REQUESTS"


class InvalidTransitionError(AppError):
    status_code = 422
    code = "INVALID_TRANSITION"


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"


def error_response(
    status_code: int,
    code: str,
    message: str,
    details: Any | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        body["details"] = details
    return JSONResponse(status_code=status_code, content={"error": body}, headers=headers)


HTTP_ERROR_CODES = {
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    429: "TOO_MANY_REQUESTS",
}


async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
    return error_response(exc.status_code, exc.code, exc.message, exc.details, exc.headers)


async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    fields = [
        {
            # ("body", "title") -> "title"; ("query", "status", 0) -> "status";
            # JSON malformado vem como ("body", <posição>) -> "body"
            "field": ".".join(part for part in error["loc"][1:] if isinstance(part, str))
            or str(error["loc"][0]),
            "message": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors()
    ]
    return error_response(422, "VALIDATION_ERROR", "Dados inválidos.", {"fields": fields})


async def handle_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = HTTP_ERROR_CODES.get(exc.status_code, "HTTP_ERROR")
    message = exc.detail if isinstance(exc.detail, str) else "Erro na requisição."
    if exc.status_code == 404 and message == "Not Found":
        message = "Recurso não encontrado."
    return error_response(exc.status_code, code, message)


async def handle_database_unavailable(request: Request, exc: Exception) -> JSONResponse:
    # Falha de conexão (banco fora, reiniciando ou lento demais): erro temporário.
    # O cliente recebe 503 e sabe que pode tentar de novo; nada de detalhe interno.
    logger.warning("Banco indisponível em %s %s: %s", request.method, request.url.path, exc)
    return error_response(
        503,
        "SERVICE_UNAVAILABLE",
        "Banco de dados temporariamente indisponível. Tente novamente em instantes.",
        headers={"Retry-After": "5"},
    )


async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    # O detalhe vai para o log do servidor, nunca para o cliente.
    logger.exception("Erro inesperado em %s %s", request.method, request.url.path)
    return error_response(500, "INTERNAL_ERROR", "Erro interno. Tente novamente em instantes.")


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, handle_app_error)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, handle_http_error)
    app.add_exception_handler(OperationalError, handle_database_unavailable)
    app.add_exception_handler(InterfaceError, handle_database_unavailable)
    app.add_exception_handler(Exception, handle_unexpected_error)
