from io import BytesIO
from typing import Any


def risk_report(ticker: str, scenario: str, confidence: float, forecast: dict[str, Any],
                risk: dict[str, Any], stress: dict[str, Any]) -> bytes:
    """Build a PDF from the same forecast, portfolio, and stress calculations as the API."""
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    output = BytesIO()
    styles = getSampleStyleSheet()
    document = SimpleDocTemplate(output, title="RiskLab risk report")
    rows = [
        ["Model", "Latest forecast", "MAE", "RMSE"],
        *[[model.upper(), f"{forecast['predictions'][model][-1]:.3%}", f"{scores['mae']:.3%}",
           f"{scores['rmse']:.3%}"] for model, scores in forecast["metrics"].items()],
    ]
    models = Table(rows, hAlign="LEFT", repeatRows=1)
    models.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eeeeee")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    content = [
        Paragraph("RiskLab risk report", styles["Title"]),
        Paragraph(f"Portfolio data through {risk['dates'][-1]}. Confidence {confidence:.1%}.", styles["Normal"]),
        Paragraph(f"{ticker} daily volatility", styles["Heading2"]),
        Paragraph(f"Held-out dates {forecast['dates'][0]} to {forecast['dates'][-1]}. "
                  "The latest forecast refers to the last held-out date.", styles["Normal"]),
        Spacer(1, 8), models,
        Paragraph("Portfolio risk", styles["Heading2"]),
    ]
    for key, label in [("historical", "Historical"), ("parametric", "Normal")]:
        content.append(Paragraph(f"{label} VaR {risk[key]['var']:.2%} | CVaR {risk[key]['cvar']:.2%}", styles["Normal"]))
    sharpe = "Undefined" if risk["sharpe"] is None else f"{risk['sharpe']:.2f}"
    content.extend([
        Paragraph(f"Annualized Sharpe {sharpe} | Maximum drawdown {risk['max_drawdown']:.2%}", styles["Normal"]),
        Paragraph("Stress scenario", styles["Heading2"]),
        Paragraph(f"{scenario} | Portfolio loss {stress['loss']:.2%} (negative indicates a gain).", styles["Normal"]),
        Spacer(1, 12),
        Paragraph("Research and education only. Results use local historical prices and hypothetical shocks.", styles["Normal"]),
    ])
    document.build(content)
    return output.getvalue()
