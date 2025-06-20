'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { createClient } from "@/utils/supabase/client"

export default function UploadPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [stage, setStage] = useState('')
  const [buildingType, setBuildingType] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!imageFile) return alert("Please upload an image")

    const ext = imageFile.name.split('.').pop()
    const filename = `${Date.now()}.${ext}`

    const { error: uploadError } = await supabase
      .storage
      .from('project-images')
      .upload(filename, imageFile)

    if (uploadError) {
      console.error(uploadError)
      return alert("Image upload failed")
    }

    const { data: urlData } = supabase
      .storage
      .from('project-images')
      .getPublicUrl(filename)

    const imageUrl = urlData.publicUrl

    const { error: dbError } = await supabase
      .from('projects')
      .insert([
        {
          name,
          description,
          stage,
          building_type: buildingType,
          image_url: imageUrl,
        }
      ])

    if (dbError) {
      console.error(dbError)
      return alert("Upload failed")
    }

    alert("Project uploaded successfully")
    router.push('/')
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Upload New Project</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Project Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>
        <div>
          <Label>Stage</Label>
          <Select onValueChange={setStage}>
            <SelectTrigger>
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Concept">Concept</SelectItem>
              <SelectItem value="Schematic">Schematic</SelectItem>
              <SelectItem value="Development">Development</SelectItem>
              <SelectItem value="Construction">Construction</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Building Type</Label>
          <Select onValueChange={setBuildingType}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Residential">Residential</SelectItem>
              <SelectItem value="Commercial">Commercial</SelectItem>
              <SelectItem value="Institutional">Institutional</SelectItem>
              <SelectItem value="Civic">Civic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Upload Image</Label>
          <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
        </div>
        <Button type="submit" className="w-full">Submit</Button>
      </form>
    </div>
  )
}
