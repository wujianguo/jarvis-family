import { useState } from "react"
import { View, Text, Input, Textarea, Button } from "@tarojs/components"
import Taro, { useLoad, useRouter } from "@tarojs/taro"
import { api, type Pickup } from "../../api"
export default function Form() {
  const id = useRouter().params.id
  const [address, setAddress] = useState(""),
    [pickupCode, setPickupCode] = useState(""),
    [recipientName, setRecipientName] = useState(""),
    [rawInfo, setRawInfo] = useState(""),
    [error, setError] = useState("")
  useLoad(() => {
    if (id)
      void api<Pickup>(`/express/pickups/${id}`).then((p) => {
        setAddress(p.address)
        setPickupCode(p.pickupCode)
        setRecipientName(p.recipientName || "")
        setRawInfo(p.rawInfo || "")
      })
  })
  const save = async () => {
    try {
      await api(
        id ? `/express/pickups/${id}` : "/express/pickups",
        id ? "PATCH" : "POST",
        { address, pickupCode, recipientName, rawInfo }
      )
      Taro.navigateBack()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <View className="page">
      <View className="hero">
        <Text className="title">{id ? "编辑快递" : "录入快递"}</Text>
      </View>
      <View className="panel form">
        <Text>取件地点 *</Text>
        <Input
          placeholder="例如：小区驿站"
          value={address}
          maxlength={200}
          onInput={(e) => setAddress(e.detail.value)}
        />
        <Text>取件码 *</Text>
        <Input
          placeholder="输入取件码"
          value={pickupCode}
          maxlength={80}
          onInput={(e) => setPickupCode(e.detail.value)}
        />
        <Text>收件人</Text>
        <Input
          placeholder="可选"
          value={recipientName}
          maxlength={80}
          onInput={(e) => setRecipientName(e.detail.value)}
        />
        <Text>通知原文</Text>
        <Textarea
          placeholder="可选"
          value={rawInfo}
          maxlength={4000}
          onInput={(e) => setRawInfo(e.detail.value)}
        />
      </View>
      <Button
        className="primary"
        disabled={!address.trim() || !pickupCode.trim()}
        onClick={save}
      >
        保存
      </Button>
      {error && <Text className="error">{error}</Text>}
    </View>
  )
}
