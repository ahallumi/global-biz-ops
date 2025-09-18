import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePasswordReset } from "@/hooks/usePasswordReset";
import { User } from "@/hooks/useUsers";
import { KeyRound, Mail, AlertTriangle } from "lucide-react";

interface PasswordResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function PasswordResetDialog({ 
  open, 
  onOpenChange, 
  user 
}: PasswordResetDialogProps) {
  const passwordReset = usePasswordReset();

  const handleSendReset = () => {
    if (!user?.email || !user?.id) return;
    
    passwordReset.mutate(
      { email: user.email, user_id: user.id },
      {
        onSuccess: () => {
          onOpenChange(false);
        }
      }
    );
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Reset Password
          </DialogTitle>
          <DialogDescription>
            Send a password reset email to this user
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50">
            <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium">{user.full_name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This will send a password reset email to the user. They will be able to set a new password 
              using the link in the email.
            </AlertDescription>
          </Alert>

          <div className="space-y-2 text-sm text-muted-foreground">
            <h4 className="font-medium text-foreground">What happens next:</h4>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>User receives a password reset email</li>
              <li>They click the link to access the password reset page</li>
              <li>User sets a new password</li>
              <li>Old password becomes invalid</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={passwordReset.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendReset}
            disabled={passwordReset.isPending}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {passwordReset.isPending ? (
              <>
                <Mail className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Reset Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}