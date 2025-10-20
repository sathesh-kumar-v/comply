"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  FileText,
  Download,
  Edit,
  Trash2,
  MoreHorizontal,
  Eye,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react'
import { DocumentEditor } from './document-editor'

interface Document {
  id: number
  title: string
  document_type: string
  status: string
  access_level: string
  category?: string
  filename: string
  file_size: number
  version: string
  created_by_id: number
  created_at: string
  updated_at: string
  next_review_date?: string
}

interface DocumentsListProps {
  documents: Document[]
  loading: boolean
  onRefresh: () => void
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function DocumentsList({ 
  documents, 
  loading, 
  onRefresh, 
  currentPage, 
  totalPages, 
  onPageChange 
}: DocumentsListProps) {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'published': return 'bg-green-100 text-green-800'
      case 'approved': return 'bg-blue-100 text-blue-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'under_review': return 'bg-yellow-100 text-yellow-800'
      case 'expired': return 'bg-red-100 text-red-800'
      case 'archived': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getAccessLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'public': return 'bg-green-100 text-green-800'
      case 'internal': return 'bg-blue-100 text-blue-800'
      case 'confidential': return 'bg-orange-100 text-orange-800'
      case 'restricted': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getDocumentTypeIcon = (type: string) => {
    // Return appropriate icon based on document type
    return <FileText className="h-4 w-4" />
  }

  const isExpiringSoon = (reviewDate?: string) => {
    if (!reviewDate) return false
    const review = new Date(reviewDate)
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000))
    return review <= thirtyDaysFromNow
  }

  const handleDownload = async (doc: Document) => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        console.error('No authentication token found')
        return
      }
      
      const response = await fetch(`${API_BASE_URL}/api/documents/${doc.id}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
  
      if (response.ok) {
        console.log('response:-', response)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = doc.filename
        a.click()
        window.URL.revokeObjectURL(url)
      } else {
        console.error('Failed to download document')
      }
    } catch (error) {
      console.error('Error downloading document:', error)
    }
  }

  const handleEdit = (document: Document) => {
    setEditingDocument(document)
  }

  const handleSaveEdit = async (updatedDocument: Partial<Document>) => {
    if (!editingDocument) return
    
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        console.error('No authentication token found')
        return
      }
      
      const response = await fetch(`${API_BASE_URL}/api/documents/${editingDocument.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedDocument)
      })

      if (response.ok) {
        onRefresh() // Refresh the documents list
        setEditingDocument(null)
      } else {
        console.error('Failed to update document')
        throw new Error('Failed to update document')
      }
    } catch (error) {
      console.error('Error updating document:', error)
      throw error
    }
  }

  const handleDelete = async (document: Document) => {
    if (!confirm(`Are you sure you want to delete "${document.title}"?`)) {
      return
    }

    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        console.error('No authentication token found')
        return
      }
      
      const response = await fetch(`${API_BASE_URL}/api/documents/${document.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        onRefresh()
      } else {
        console.error('Failed to delete document')
      }
    } catch (error) {
      console.error('Error deleting document:', error)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span>Loading documents...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No documents found</h3>
          <p className="text-muted-foreground mb-4">
            Get started by uploading your first document or adjust your search filters.
          </p>
          <Button onClick={onRefresh} variant="outline">
            Refresh
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 sm:w-12"></TableHead>
                <TableHead className="min-w-[200px]">Document</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Access Level</TableHead>
                <TableHead className="hidden md:table-cell">Version</TableHead>
                <TableHead className="hidden lg:table-cell">Size</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
                <TableHead className="hidden xl:table-cell">Review</TableHead>
                <TableHead className="w-8 sm:w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => (
                <TableRow key={document.id} className="hover:bg-muted/50">
                  <TableCell>
                    {getDocumentTypeIcon(document.document_type)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium text-sm sm:text-base">{document.title}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {document.filename}
                      </div>
                      {document.category && (
                        <Badge variant="outline" className="text-xs">
                          {document.category}
                        </Badge>
                      )}
                      {/* Show additional info on mobile */}
                      <div className="sm:hidden space-y-1">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-xs">
                            {document.document_type.replace('_', ' ')}
                          </Badge>
                          <Badge className={getStatusColor(document.status) + " text-xs"}>
                            {document.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          v{document.version} • {formatFileSize(document.file_size)} • {formatDate(document.created_at)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline" className="text-xs">
                      {document.document_type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge className={getStatusColor(document.status) + " text-xs"}>
                      {document.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge className={getAccessLevelColor(document.access_level) + " text-xs"}>
                      {document.access_level}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <code className="text-xs sm:text-sm">{document.version}</code>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs sm:text-sm">
                    {formatFileSize(document.file_size)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs sm:text-sm">
                    {formatDate(document.created_at)}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {document.next_review_date && (
                      <div className="flex items-center space-x-1">
                        {isExpiringSoon(document.next_review_date) ? (
                          <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500" />
                        ) : (
                          <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        )}
                        <span className="text-xs sm:text-sm">
                          {formatDate(document.next_review_date)}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedDocument(document)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload(document)}>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(document)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(document)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="w-full sm:w-auto"
          >
            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden xs:inline">Previous</span>
            <span className="xs:hidden">Prev</span>
          </Button>
          
          <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
            Page {currentPage} of {totalPages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="w-full sm:w-auto"
          >
            <span className="hidden xs:inline">Next</span>
            <span className="xs:hidden">Next</span>
            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
          </Button>
        </div>
      )}

      {/* Document Details Modal */}
      <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedDocument?.title}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDocument(null)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
            <DialogDescription>
              Document details and metadata
            </DialogDescription>
          </DialogHeader>
          
          {selectedDocument && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Basic Information</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Title:</span> {selectedDocument.title}</div>
                    <div><span className="font-medium">Type:</span> {selectedDocument.document_type.replace('_', ' ')}</div>
                    <div><span className="font-medium">Status:</span> <Badge className={getStatusColor(selectedDocument.status)}>{selectedDocument.status.replace('_', ' ')}</Badge></div>
                    <div><span className="font-medium">Access Level:</span> <Badge className={getAccessLevelColor(selectedDocument.access_level)}>{selectedDocument.access_level}</Badge></div>
                    <div><span className="font-medium">Category:</span> {selectedDocument.category || 'N/A'}</div>
                    <div><span className="font-medium">Version:</span> {selectedDocument.version}</div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">File Information</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Filename:</span> {selectedDocument.filename}</div>
                    <div><span className="font-medium">Size:</span> {formatFileSize(selectedDocument.file_size)}</div>
                    <div><span className="font-medium">Created:</span> {formatDate(selectedDocument.created_at)}</div>
                    <div><span className="font-medium">Updated:</span> {formatDate(selectedDocument.updated_at)}</div>
                    {selectedDocument.next_review_date && (
                      <div><span className="font-medium">Next Review:</span> {formatDate(selectedDocument.next_review_date)}</div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => handleDownload(selectedDocument)} size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setSelectedDocument(null)
                    handleEdit(selectedDocument)
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => {
                    setSelectedDocument(null)
                    handleDelete(selectedDocument)
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Document Editor */}
      {editingDocument && (
        <DocumentEditor
          document={editingDocument}
          isOpen={!!editingDocument}
          onClose={() => setEditingDocument(null)}
          onSave={handleSaveEdit}
          onDownload={() => handleDownload(editingDocument)}
        />
      )}
    </div>
  )
}