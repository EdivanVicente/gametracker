"""
Rotas de autenticação e perfil.

Fluxo de cadastro (com confirmação por e-mail):
    1. POST /auth/register   -> cria o usuário (não verificado) e envia o e-mail de confirmação
    2. GET  /auth/verify      -> usuário clica no link do e-mail, conta é marcada como verificada
    3. POST /auth/login       -> só funciona depois do e-mail confirmado
    4. POST /auth/resend-verification -> reenvia o e-mail, caso o usuário não tenha recebido
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token, generate_verification_token
from app.core.deps import get_current_user
from app.services.email_service import send_verification_email

router = APIRouter(prefix="/auth", tags=["Autenticação"])


def _issue_verification_token(user: models.User, db: Session) -> str:
    token = generate_verification_token()
    user.verification_token = token
    user.verification_token_expires_at = datetime.utcnow() + timedelta(
        minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES
    )
    db.commit()
    return token


@router.post("/register", response_model=schemas.RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este e-mail já está cadastrado.",
        )

    new_user = models.User(
        email=user_in.email,
        password_hash=hash_password(user_in.password),
        is_verified=False,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = _issue_verification_token(new_user, db)
    send_verification_email(new_user.email, token)

    return schemas.RegisterResponse(
        message="Cadastro criado! Enviamos um e-mail de confirmação — verifique sua caixa de entrada (e o spam) antes de entrar.",
        email=new_user.email,
    )


@router.get("/verify", response_class=HTMLResponse)
def verify_email(token: str, db: Session = Depends(get_db)):
    """Rota acessada diretamente pelo link do e-mail de confirmação."""
    user = db.query(models.User).filter(models.User.verification_token == token).first()

    def _page(title: str, message: str, ok: bool) -> str:
        color = "#3ddc84" if ok else "#ff5c7a"
        return f"""
        <html><head><meta charset="utf-8"><title>{title}</title></head>
        <body style="font-family: Arial, sans-serif; background:#0e1116; color:#e8eaed;
                     display:flex; align-items:center; justify-content:center; height:100vh; margin:0;">
          <div style="text-align:center; max-width:420px; padding:2rem;">
            <h2 style="color:{color};">{title}</h2>
            <p style="color:#8b93a1;">{message}</p>
            <a href="{settings.FRONTEND_BASE_URL}/index.html"
               style="display:inline-block; margin-top:1rem; background:#7c5cff; color:#fff;
                      padding:0.7rem 1.4rem; border-radius:6px; text-decoration:none; font-weight:bold;">
               Ir para o login
            </a>
          </div>
        </body></html>
        """

    if not user:
        return HTMLResponse(_page("Link inválido", "Este link de confirmação não é válido.", ok=False))

    if user.is_verified:
        return HTMLResponse(_page("E-mail já confirmado", "Sua conta já estava verificada. Você já pode entrar.", ok=True))

    if user.verification_token_expires_at and user.verification_token_expires_at < datetime.utcnow():
        return HTMLResponse(_page(
            "Link expirado",
            "Este link expirou. Peça um novo e-mail de confirmação na tela de login.",
            ok=False,
        ))

    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires_at = None
    db.commit()

    return HTMLResponse(_page("E-mail confirmado!", "Sua conta foi verificada com sucesso. Você já pode entrar.", ok=True))


@router.post("/resend-verification")
def resend_verification(payload: schemas.ResendVerificationRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()

    # Não revela se o e-mail existe ou não (evita enumeração de contas).
    if not user or user.is_verified:
        return {"message": "Se o e-mail existir e ainda não tiver sido confirmado, um novo link foi enviado."}

    token = _issue_verification_token(user, db)
    send_verification_email(user.email, token)
    return {"message": "Se o e-mail existir e ainda não tiver sido confirmado, um novo link foi enviado."}


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm usa os campos "username" e "password" por padrão.
    # Aqui tratamos "username" como sendo o e-mail do usuário.
    user = db.query(models.User).filter(models.User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.",
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    return schemas.Token(access_token=access_token)


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    """Retorna os dados do usuário autenticado (perfil + validação do token no frontend)."""
    return current_user


@router.patch("/me", response_model=schemas.UserOut)
def update_me(
    payload: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Atualiza nome de exibição e/ou foto de perfil."""
    data = payload.model_dump(exclude_unset=True)

    if "display_name" in data:
        current_user.display_name = data["display_name"]
    if "avatar_data" in data:
        current_user.avatar_data = data["avatar_data"]

    db.commit()
    db.refresh(current_user)
    return current_user
