import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, File, Download, Trash2, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmployeeFilesTabProps {
  employeeId: string;
}

// Mock data for now - will be replaced with actual hooks later
const mockFiles = [
  {
    id: '1',
    name: 'Employee_Handbook_Signed.pdf',
    size: 2485760,
    type: 'application/pdf',
    uploadedAt: '2024-01-15T10:30:00Z',
    category: 'Agreement'
  },
  {
    id: '2',
    name: 'Tax_Forms_W4.pdf',
    size: 1024000,
    type: 'application/pdf',
    uploadedAt: '2024-01-10T14:20:00Z',
    category: 'Tax'
  },
  {
    id: '3',
    name: 'Direct_Deposit_Form.pdf',
    size: 512000,
    type: 'application/pdf',
    uploadedAt: '2024-01-08T09:15:00Z',
    category: 'Payroll'
  }
];

export function EmployeeFilesTab({ employeeId }: EmployeeFilesTabProps) {
  const [files] = useState(mockFiles);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCategoryBadge = (category: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      Agreement: 'default',
      Tax: 'secondary',
      Payroll: 'outline'
    };
    return <Badge variant={variants[category] || 'outline'}>{category}</Badge>;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Mock upload process
    setUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploading(false);
          toast({
            title: "File Uploaded",
            description: `${file.name} has been uploaded successfully.`,
          });
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleDownload = (fileId: string, fileName: string) => {
    toast({
      title: "Download Started",
      description: `Downloading ${fileName}...`,
    });
    // Mock download - in real implementation, this would trigger file download
  };

  const handleDelete = (fileId: string, fileName: string) => {
    toast({
      title: "File Deleted",
      description: `${fileName} has been deleted.`,
      variant: "destructive",
    });
    // Mock delete - in real implementation, this would delete the file
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.jpg,.png"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <Button
              variant="outline"
              className="flex items-center space-x-2"
              disabled={uploading}
            >
              <Upload className="h-4 w-4" />
              <span>Upload</span>
            </Button>
          </div>
          
          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}
          
          <p className="text-sm text-muted-foreground">
            Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG. Max size: 10MB
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employee Files ({files.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-8">
              <File className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No files uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <File className="h-8 w-8 text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="font-medium">{file.name}</p>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>{formatFileSize(file.size)}</span>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                        </div>
                        {getCategoryBadge(file.category)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(file.id, file.name)}
                      className="flex items-center space-x-1"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(file.id, file.name)}
                      className="flex items-center space-x-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}