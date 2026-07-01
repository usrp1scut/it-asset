"""Lark interactive-card builders — pure JSON, no I/O (easy to unit-test)."""


def receipt_card(
    *,
    title: str,
    lines: list[str],
    ack_value: dict,
    acknowledged: bool = False,
    ack_time: str | None = None,
) -> dict:
    """A 领用确认 card. Un-acknowledged: shows a 「确认收到」 button carrying
    `ack_value` (echoed back on the card-action callback). Acknowledged: shows a
    green confirmed note instead of the button (so it can't be tapped twice)."""
    elements: list[dict] = [
        {"tag": "div", "text": {"tag": "lark_md", "content": "\n".join(lines)}},
        {"tag": "hr"},
    ]
    if acknowledged:
        note = "✅ **已确认领取**" + (f"  ·  {ack_time}" if ack_time else "")
        elements.append({"tag": "div", "text": {"tag": "lark_md", "content": note}})
    else:
        elements.append(
            {
                "tag": "action",
                "actions": [
                    {
                        "tag": "button",
                        "text": {"tag": "plain_text", "content": "✅ 确认收到"},
                        "type": "primary",
                        "value": ack_value,
                    }
                ],
            }
        )
    return {
        "config": {"wide_screen_mode": True},
        "header": {
            "title": {"tag": "plain_text", "content": title},
            "template": "green" if acknowledged else "blue",
        },
        "elements": elements,
    }
