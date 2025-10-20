"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  HelpCircle, 
  FileText, 
  Clock, 
  CheckCircle, 
  Eye, 
  Archive, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react'

export function StatusWorkflowHelp() {
  const statusSteps = [
    {
      status: 'draft',
      label: 'Draft',
      icon: FileText,
      color: 'bg-gray-100 text-gray-800',
      description: 'Document is being prepared and is not yet ready for review.',
      actions: ['Edit content', 'Add metadata', 'Submit for review']
    },
    {
      status: 'under_review',
      label: 'Under Review',
      icon: Clock,
      color: 'bg-yellow-100 text-yellow-800',
      description: 'Document is being reviewed by managers or auditors.',
      actions: ['Await feedback', 'Make revisions if needed']
    },
    {
      status: 'approved',
      label: 'Approved',
      icon: CheckCircle,
      color: 'bg-blue-100 text-blue-800',
      description: 'Document has been approved but not yet published.',
      actions: ['Schedule publication', 'Final review']
    },
    {
      status: 'published',
      label: 'Published',
      icon: Eye,
      color: 'bg-green-100 text-green-800',
      description: 'Document is live and accessible to authorized users.',
      actions: ['Monitor usage', 'Plan updates', 'Track reviews']
    },
    {
      status: 'archived',
      label: 'Archived',
      icon: Archive,
      color: 'bg-purple-100 text-purple-800',
      description: 'Document is no longer active but kept for record purposes.',
      actions: ['Reference only', 'Restore if needed']
    },
    {
      status: 'expired',
      label: 'Expired',
      icon: AlertTriangle,
      color: 'bg-red-100 text-red-800',
      description: 'Document has passed its expiration date and needs attention.',
      actions: ['Review content', 'Update or archive', 'Extend validity']
    }
  ]

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <HelpCircle className="h-4 w-4" />
          Document Status Help
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Document Status Workflow</DialogTitle>
          <DialogDescription>
            Understanding the document lifecycle and status transitions in your compliance system
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Workflow Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Why Use Status Workflow?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-2">✅ Benefits</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Ensures quality control</li>
                    <li>• Maintains compliance standards</li>
                    <li>• Creates audit trail</li>
                    <li>• Prevents premature publication</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">🔄 Process</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Documents start as drafts</li>
                    <li>• Review ensures accuracy</li>
                    <li>• Approval confirms readiness</li>
                    <li>• Publication makes it live</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {statusSteps.map((step, index) => {
              const IconComponent = step.icon
              return (
                <Card key={step.status}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center space-x-2">
                          <Badge className={step.color}>
                            {step.label}
                          </Badge>
                          {index < 3 && (
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {step.description}
                        </p>
                        <div className="space-y-1">
                          <p className="text-xs font-medium">Typical Actions:</p>
                          <ul className="text-xs text-muted-foreground space-y-0.5">
                            {step.actions.map((action, idx) => (
                              <li key={idx}>• {action}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Quick Tips */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-base text-blue-900">💡 Quick Tips</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-blue-800 space-y-2">
              <p><strong>For New Users:</strong> Start with "Draft" status to ensure proper review</p>
              <p><strong>For Urgent Documents:</strong> You can set "Published" if you have proper authorization</p>
              <p><strong>For Updates:</strong> Consider setting to "Under Review" when making significant changes</p>
              <p><strong>For Compliance:</strong> Always follow your organization's document approval process</p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}