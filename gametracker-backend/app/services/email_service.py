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
        logger.warning("SMTP não configurado — link de confirmação para %s: %s", to_email, link)
        print(f"[DEV] Link de confirmação de e-mail para {to_email}: {link}")
        return

    _send(
        to_email=to_email,
        subject="Confirme seu e-mail — GameTracker Pro",
        heading="GameTracker Pro",
        body_html=f"""
          <p>Olá! Confirme seu cadastro clicando no botão abaixo:</p>
          <p style="text-align:center; margin: 24px 0;">
            <a href="{link}" style="background:#7c5cff; color:#fff; padding:12px 24px;
               border-radius:6px; text-decoration:none; font-weight:bold;">
               Confirmar e-mail
            </a>
          </p>
          <p style="color:#888; font-size: 0.85rem;">Se você não criou essa conta, ignore este e-mail.</p>
        """,
        body_text=f"Olá!\n\nConfirme seu cadastro no GameTracker Pro clicando no link:\n{link}\n\nSe você não criou essa conta, ignore este e-mail.",
    )


def send_email_change_confirmation(to_email: str, new_email: str, token: str) -> None:
    """Envia o link de confirmação para o NOVO e-mail, antes de trocar de fato."""
    link = f"{settings.BACKEND_BASE_URL}/auth/confirm-email-change?token={token}"

    if not settings.SMTP_HOST:
        logger.warning("SMTP não configurado — link de troca de e-mail para %s: %s", new_email, link)
        print(f"[DEV] Link de confirmação de troca de e-mail para {new_email}: {link}")
        return

    _send(
        to_email=new_email,
        subject="Confirme seu novo e-mail — GameTracker Pro",
        heading="GameTracker Pro",
        body_html=f"""
          <p>Você pediu para trocar o e-mail da sua conta para este endereço.
          Clique no botão abaixo para confirmar:</p>
          <p style="text-align:center; margin: 24px 0;">
            <a href="{link}" style="background:#7c5cff; color:#fff; padding:12px 24px;
               border-radius:6px; text-decoration:none; font-weight:bold;">
               Confirmar novo e-mail
            </a>
          </p>
          <p style="color:#888; font-size: 0.85rem;">Se você não pediu essa troca, ignore este e-mail — sua conta continua com o e-mail atual.</p>
        """,
        body_text=f"Você pediu para trocar o e-mail da sua conta.\n\nConfirme clicando no link:\n{link}\n\nSe você não pediu essa troca, ignore este e-mail.",
    )


def send_account_deletion_confirmation(to_email: str, token: str) -> None:
    link = f"{settings.BACKEND_BASE_URL}/auth/confirm-deletion?token={token}"

    if not settings.SMTP_HOST:
        logger.warning("SMTP não configurado — link de exclusão de conta para %s: %s", to_email, link)
        print(f"[DEV] Link de confirmação de exclusão de conta para {to_email}: {link}")
        return

    _send(
        to_email=to_email,
        subject="Confirme a exclusão da sua conta — GameTracker Pro",
        heading="Excluir conta",
        body_html=f"""
          <p>Você pediu para excluir permanentemente sua conta do GameTracker Pro,
          junto com todos os jogos catalogados. Essa ação <strong>não pode ser desfeita</strong>.</p>
          <p style="text-align:center; margin: 24px 0;">
            <a href="{link}" style="background:#ff5c7a; color:#fff; padding:12px 24px;
               border-radius:6px; text-decoration:none; font-weight:bold;">
               Confirmar exclusão definitiva
            </a>
          </p>
          <p style="color:#888; font-size: 0.85rem;">Se você não pediu isso, ignore este e-mail — sua conta continua normalmente.</p>
        """,
        body_text=f"Você pediu para excluir sua conta do GameTracker Pro (ação permanente).\n\nConfirme clicando no link:\n{link}\n\nSe você não pediu isso, ignore este e-mail.",
    )


def _send(to_email: str, subject: str, heading: str, body_html: str, body_text: str) -> None:
    if not settings.SMTP_HOST:
        logger.warning("SMTP não configurado — e-mail '%s' não enviado para %s.", subject, to_email)
        print(f"[DEV] ({subject}) e-mail não enviado (SMTP ausente) para {to_email}")
        return

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM
    message["To"] = to_email

    html_wrapper = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#7c5cff;">{heading}</h2>
      {body_html}
    </div>
    """

    message.attach(MIMEText(body_text, "plain"))
    message.attach(MIMEText(html_wrapper, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, [to_email], message.as_string())
    except Exception:
        logger.exception("Falha ao enviar e-mail '%s' para %s", subject, to_email)
        print(f"[FALHA NO ENVIO] '{subject}' para {to_email}")
