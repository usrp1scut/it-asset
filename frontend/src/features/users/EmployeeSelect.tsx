import { useEffect, useState } from 'react'
import { Select, Spin } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'

interface Person {
  id: number
  name: string
  email: string | null
  department_name: string | null
}

export default function EmployeeSelect({
  value,
  onChange,
  placeholder = '搜索姓名 / 邮箱选择员工',
}: {
  value?: number | null
  onChange?: (v: number | null) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')

  // debounce keystrokes so we don't fire a request per character
  useEffect(() => {
    const t = setTimeout(() => setQ(input), 250)
    return () => clearTimeout(t)
  }, [input])

  const { data, isFetching } = useQuery<Person[]>({
    queryKey: ['user-search', q],
    queryFn: async () => (await api.get('/users', { params: { q: q || undefined } })).data,
  })

  const options = (data ?? []).map((p) => ({
    value: p.id,
    label: [p.name, p.department_name, p.email].filter(Boolean).join(' · '),
  }))

  return (
    <Select
      showSearch
      allowClear
      value={value ?? undefined}
      placeholder={placeholder}
      filterOption={false}
      onSearch={setInput}
      onChange={(v) => onChange?.((v as number | undefined) ?? null)}
      notFoundContent={isFetching ? <Spin size="small" /> : null}
      options={options}
      style={{ width: '100%' }}
    />
  )
}
