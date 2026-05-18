import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './styles/tokens.css'
import './styles/global.css'

const queryClient = new QueryClient()

// Lark-native theme — primary color from design tokens (README §5).
const theme = {
  token: {
    colorPrimary: '#3370FF',
    borderRadius: 6,
    fontFamily: "'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', Arial, sans-serif",
  },
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={theme}>
        <App />
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
