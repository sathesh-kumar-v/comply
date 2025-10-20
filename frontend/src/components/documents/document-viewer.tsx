"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  FileText, 
  Download, 
  AlertTriangle, 
  Loader2, 
  Eye,
  ExternalLink,
  Maximize2
} from 'lucide-react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://comply-x.onrender.com'

interface DocumentViewerProps {
  documentId: number
  filename: string
  mimeType?: string
  className?: string
  showDownload?: boolean
}

export function DocumentViewer({ 
  documentId, 
  filename, 
  mimeType,
  className = "",
  showDownload = true
}: DocumentViewerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)

  useEffect(() => {
    loadDocument()
  }, [documentId])

  const loadDocument = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        setError('No authentication token found')
        return
      }

      // Create blob URL for viewing
      const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) {
        throw new Error('Failed to load document')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setDocumentUrl(url)
      
    } catch (error) {
      console.error('Error loading document:', error)
      setError('Failed to load document')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Error downloading document:', error)
    }
  }

  const getFileExtension = () => {
    return filename?.split('.').pop()?.toLowerCase() || ''
  }

  const renderViewer = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span>Loading document...</span>
        </div>
      )
    }

    if (error || !documentUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-red-600 space-y-2">
          <AlertTriangle className="h-8 w-8" />
          <span>{error || 'Failed to load document'}</span>
          <Button variant="outline" size="sm" onClick={loadDocument}>
            Retry
          </Button>
        </div>
      )
    }

    const extension = getFileExtension()
    
    // PDF files
    if (extension === 'pdf') {
      return (
        <div className="w-full h-full">
          <embed 
            src={documentUrl} 
            type="application/pdf" 
            width="100%" 
            height="500"
            className="border rounded-lg"
          />
        </div>
      )
    }

    // Image files
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension)) {
      return (
        <div className="flex justify-center">
          <img 
            src={documentUrl} 
            alt={filename}
            className="max-h-96 object-contain border rounded-lg shadow-sm"
          />
        </div>
      )
    }

    // Text files
    if (['txt', 'md', 'json', 'xml', 'csv'].includes(extension) || mimeType?.includes('text')) {
      return (
        <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-auto">
          <iframe 
            src={documentUrl} 
            className="w-full h-80 border-0"
            title={filename}
          />
        </div>
      )
    }

    // Office documents (Word, Excel, PowerPoint)
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) {
      // Try to use Office Online viewer
      const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(documentUrl)}`
      
      return (
        <div className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <iframe 
              src={officeUrl} 
              className="w-full h-96"
              title={filename}
              onError={() => {
                // Fallback if Office viewer fails
                console.log('Office viewer failed, showing download option')
              }}
            />
          </div>
          <div className="text-center text-sm text-muted-foreground space-y-2">
            <p>If the preview doesn't load, try downloading the file to view it locally.</p>
          </div>
        </div>
      )
    }

    // HTML files
    if (extension === 'html' || extension === 'htm') {
      return (
        <div className="border rounded-lg overflow-hidden">
          <iframe 
            src={documentUrl} 
            className="w-full h-96"
            title={filename}
            sandbox="allow-same-origin"
          />
        </div>
      )
    }

    // Fallback for unsupported file types
    return (
      <div className="space-y-4">
        <div className="text-center text-muted-foreground space-y-4 py-8">
          <FileText className="h-16 w-16 mx-auto" />
          <div>
            <p className="text-lg font-medium">Preview not available</p>
            <p className="text-sm">File: {filename}</p>
            <p className="text-sm">Type: {extension.toUpperCase()} ({mimeType || 'Unknown'})</p>
          </div>
          <p className="text-sm">
            This file type cannot be previewed in the browser. Please download to view.
          </p>
        </div>
        
        <div className="flex justify-center">
          <Button onClick={handleDownload} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download File
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-medium flex items-center">
          <Eye className="h-4 w-4 mr-2" />
          Document Preview
        </CardTitle>
        {showDownload && (
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
            {documentUrl && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(documentUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {renderViewer()}
      </CardContent>
    </Card>
  )
}