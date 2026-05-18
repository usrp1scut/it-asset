import { Card, Tag, Typography } from 'antd'
import { useAuth } from '../stores/auth'

export default function Home() {
  const user = useAuth((s) => s.user)
  return (
    <div style={{ padding: 24 }}>
      <Card style={{ maxWidth: 520 }}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          欢迎,{user?.name}
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Sprint 1 · 用户与 Lark 集成已就绪 <Tag color="success">已登录</Tag>
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          资产台账、库存、工作台等模块将在后续 Sprint 落地。
        </Typography.Paragraph>
      </Card>
    </div>
  )
}
