"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { farmsApi, type Farm } from "@/lib/api"

interface CreateFarmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (farm: Farm) => void
}

export function CreateFarmModal({ open, onOpenChange, onSuccess }: CreateFarmModalProps) {
  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [country, setCountry] = useState("")
  const [state, setState] = useState("")
  const [district, setDistrict] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    try {
      const res = await farmsApi.create({
        name: name.trim(),
        location: location.trim() || undefined,
        country: country.trim() || undefined,
        state: state.trim() || undefined,
        district: district.trim() || undefined,
      })
      if (res.success && res.data) {
        toast({ title: "Farm created", description: res.data.name })
        onSuccess(res.data)
        setName("")
        setLocation("")
        setCountry("")
        setState("")
        setDistrict("")
        onOpenChange(false)
      }
    } catch {
      toast({
        title: "Failed to create farm",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create farm</DialogTitle>
          <DialogDescription>Add a new farm to associate with site evaluations.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="farm-name">Name</Label>
              <Input
                id="farm-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Farm name"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="farm-location">Location (optional)</Label>
              <Input
                id="farm-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="farm-country">Country (optional)</Label>
              <Input
                id="farm-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Country"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="farm-state">State (optional)</Label>
              <Input
                id="farm-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="farm-district">District (optional)</Label>
              <Input
                id="farm-district"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="District"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-[#387F43] hover:bg-[#2d6535]" disabled={submitting}>
              {submitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
