"""
Serviço de envio de e-mail — usado para a confirmação de cadastro.

Se SMTP_HOST não estiver configurado no .env, o e-mail não é enviado de
verdade: o link de confirmação é apenas exibido no log do servidor. Isso
mantém o cadastro funcional em ambiente de desenvolvimento sem precisar de
credenciais reais de SMTP.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger("gametracker.email")


def _build_verification_link(token: str) -> str:
    return f"{settings.BACKEND_BASE_URL}/auth/verify?token={token}"


def send_verification_email(to_email: str, token: str) -> None:
    link = _build_verification_link(token)

    if not settings.SMTP_HOST:
        # Modo desenvolvimento: sem SMTP configurado, só loga o link.
        logger.warning(
            "SMTP não configurado — link de confirmação para %s: %s",
            to_email,
            link,
        )
        print(f"[DEV] Link de confirmação de e-mail para {to_email}: {link}")
        return

    message = MIMEMultipart("alternative")
    message["Subject"] = "Confirme seu e-mail — GameTracker Pro"
    message["From"] = settings.SMTP_FROM
    message["To"] = to_email

    text_body = (
        f"Olá!\n\nConfirme seu cadastro no GameTracker Pro clicando no link:\n"
        f"{link}\n\nSe você não criou essa conta, ignore este e-mail."
    )
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#7c5cff;">GameTracker Pro</h2>
      <p>Olá! Confirme seu cadastro clicando no botão abaixo:</p>
      <p style="text-align:center; margin: 24px 0;">
        <a href="{link}" style="background:#7c5cff; color:#fff; padding:12px 24px;
           border-radius:6px; text-decoration:none; font-weight:bold;">
           Confirmar e-mail
        </a>
      </p>
      <p style="color:#888; font-size: 0.85rem;">Se você não criou essa conta, ignore este e-mail.</p>
    </div>
    """

    message.attach(MIMEText(text_body, "plain"))
    message.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, [to_email], message.as_string())
    except Exception:
        # Não deixa o cadastro falhar por causa de um problema no envio do e-mail;
        # registra o erro e o link continua disponível no log.
        logger.exception("Falha ao enviar e-mail de confirmação para %s", to_email)
        print(f"[FALHA NO ENVIO] Link de confirmação para {to_email}: {link}")
