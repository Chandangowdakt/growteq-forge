import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function PlaceholderPage() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Placeholder</CardTitle>
          <CardDescription>
            Welcome to Growteq Forge dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>This is a temporary placeholder page.</p>
        </CardContent>
      </Card>
    </div>
  )
}
