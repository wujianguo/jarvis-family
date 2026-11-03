import { useState } from "react"
import { View, Text, Button } from "@tarojs/components"
import Taro, { useDidShow, useRouter } from "@tarojs/taro"
import { api, type Pickup } from "../../api"
export default function Detail() {
  const id = useRouter().params.id || ""
  const [item, setItem] = useState<Pickup | null>(null),
    [error, setError] = useState("")
  useDidShow(() => {
    void api<Pickup>(`/express/pickups/${id}`)
      .then(setItem)
      .catch((e) => setError(e.message))
  })
  return (
    <View className="page">
      <View className="hero">
        <Text className="eyebrow">快递详情</Text>
        <Text className="title">{item?.address || "加载中…"}</Text>
      </View>
      {item && (
        <View className="panel">
          <Text className="label">取件码</Text>
          <Text className="code">{item.pickupCode}</Text>
          <Text className="label">
            状态 · {item.status === "PENDING" ? "待取" : "已取"}
          </Text>
          <Text className="label">
            来源 · {item.source === "SMS" ? "短信自动" : "手工录入"}
          </Text>
          <Text className="label">收件人 · {item.recipientName || "—"}</Text>
          <Text className="label">
            录入时间 · {new Date(item.createdAt).toLocaleString()}
          </Text>
          <Text className="label">通知原文</Text>
          <Text>{item.rawInfo || "—"}</Text>
          <Button
            onClick={() =>
              Taro.navigateTo({ url: `/pages/form/index?id=${id}` })
            }
          >
            编辑信息
          </Button>
          {item.status === "PENDING" && (
            <Button
              className="primary"
              onClick={() =>
                void api(`/express/pickups/${id}/done`, "POST")
                  .then(() => Taro.navigateBack())
                  .catch((e) => setError(e.message))
              }
            >
              标记已取
            </Button>
          )}
        </View>
      )}
      {error && <Text className="error">{error}</Text>}
    </View>
  )
}
