import { useQuery } from '@tanstack/react-query'
import { Card, Tag, Typography } from 'antd'
import axios from 'axios'

const { Title, Paragraph } = Typography

interface Health {
  status: string
  env: string
}

function App() {
  const { data, isLoading, isError } = useQuery<Health>({
    queryKey: ['health'],
    queryFn: async () => (await axios.get('/api/health')).data,
    retry: false,
  })

  const backend = isLoading
    ? { color: 'processing', text: '检测中…' }
    : isError
      ? { color: 'error', text: '未连接' }
      : { color: 'success', text: `ok · ${data?.env}` }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <Card style={{ width: 420 }}>
        <Title level={4} style={{ marginTop: 0 }}>
          IT 资产管理系统
        </Title>
        <Paragraph type="secondary">Sprint 0 · 项目骨架已就绪</Paragraph>
        <div>
          后端 <Tag color={backend.color}>{backend.text}</Tag>
        </div>
      </Card>
    </div>
  )
}

export default App
