'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { signIn, signInWithMagicLink } from '@/lib/auth/client';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, Loader2, Sparkles } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'password' | 'magic-link'>('password');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email) {
      setErrors({ email: 'Email is required' });
      return;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setErrors({ email: 'Please enter a valid email' });
      return;
    }

    setIsLoading(true);

    try {
      if (loginMethod === 'magic-link') {
        const { error } = await signInWithMagicLink(formData.email);

        if (error) {
          toast({
            title: 'Error',
            description: error,
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        toast({
          title: 'Check your email',
          description: 'We sent you a magic link. Click it to sign in.',
        });
      } else {
        if (!formData.password) {
          setErrors({ password: 'Password is required' });
          setIsLoading(false);
          return;
        } else if (formData.password.length < 6) {
          setErrors({ password: 'Password must be at least 6 characters' });
          setIsLoading(false);
          return;
        }

        const { error } = await signIn({
          email: formData.email,
          password: formData.password,
        });

        if (error) {
          toast({
            title: 'Error',
            description: error,
            variant: 'destructive',
          });
          return;
        }

        toast({
          title: 'Welcome back!',
          description: 'You have successfully signed in.',
        });

        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>
        <CardDescription className="text-center">
          Sign in to your account
        </CardDescription>
      </CardHeader>
      <div className="px-6">
        <div className="flex p-1 bg-muted rounded-lg">
          <button
            type="button"
            onClick={() => setLoginMethod('password')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              loginMethod === 'password'
                ? 'bg-background text-foreground shadow'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Lock className="inline-block w-4 h-4 mr-2" />
            Password
          </button>
          <button
            type="button"
            onClick={() => setLoginMethod('magic-link')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              loginMethod === 'magic-link'
                ? 'bg-background text-foreground shadow'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="inline-block w-4 h-4 mr-2" />
            Magic Link
          </button>
        </div>
      </div>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>
          {loginMethod === 'password' && (
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {loginMethod === 'magic-link' ? 'Sending link...' : 'Signing in...'}
              </>
            ) : loginMethod === 'magic-link' ? (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Send Magic Link
              </>
            ) : (
              'Sign in'
            )}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
          {loginMethod === 'password' && (
            <p className="text-sm text-center text-muted-foreground mt-2">
              <Link href="/reset-password" className="text-primary hover:underline">
                Forgot your password?
              </Link>
            </p>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
