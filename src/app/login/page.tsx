'use client'

import { useState } from 'react'
import { login, signup } from './actions'
import { loginWithIp, loginWithGps } from '@/app/actions/auth-advanced'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Wifi, MapPin, Mail, Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [viewPassword, setViewPassword] = useState(false)

  async function handleLogin(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  async function handleSignup(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await signup(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  async function handleIpLogin() {
    if (!email) {
      setError('Please enter your email first.')
      return
    }
    setLoading(true)
    setError(null)

    const result = await loginWithIp(email)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else if (result.success && result.url) {
      toast.success('IP Verified! Logging you in...')
      window.location.href = result.url // Redirect to Magic Link
    }
  }

  async function handleGpsLogin() {
    if (!email) {
      setError('Please enter your email first.')
      return
    }
    setLoading(true)
    setError(null)

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        const result = await loginWithGps(email, latitude, longitude)
        console.log("result: ", result)

        if (result.error) {
          setError(result.error)
          setLoading(false)
        } else if (result.success && result.url) {
          toast.success('Location Verified! Logging you in...')
          window.location.href = result.url
        }
      },
      (err) => {
        console.error(err)
        setError('Failed to retrieve location. Please allow location access.')
        setLoading(false)
      }
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-800">
      <Tabs defaultValue="login" className="w-[400px]">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="signup">Sign Up</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>Login</CardTitle>
              <CardDescription>
                Choose your preferred login method.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="email" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="email"><Mail className="w-4 h-4" /></TabsTrigger>
                  {/* <TabsTrigger value="ip"><Wifi className="w-4 h-4" /></TabsTrigger> */}
                  <TabsTrigger value="gps"><MapPin className="w-4 h-4" /></TabsTrigger>
                </TabsList>

                <TabsContent value="email">
                  <form action={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="user@example.com"
                        required
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="flex items-center gap-2">
                        <Input id="password" name="password" type={viewPassword ? "text" : "password"} placeholder='********' required />
                        <Button type="button" onClick={() => setViewPassword(!viewPassword)} className="w-10 h-10">
                          {viewPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Login'}
                    </Button>
                  </form>
                </TabsContent>

                {/* <TabsContent value="ip">
                  <div className="space-y-4 text-center">
                    <div className="p-4 bg-blue-50 text-blue-700 rounded-lg text-sm">
                      One-Tap Login using your Office Wi-Fi/Network.
                    </div>
                    <div className="space-y-2 text-left">
                      <Label htmlFor="ip-email">Email</Label>
                      <Input
                        id="ip-email"
                        type="email"
                        placeholder="m@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button onClick={handleIpLogin} className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Login with IP'}
                    </Button>
                  </div>
                </TabsContent> */}

                <TabsContent value="gps">
                  <div className="space-y-4 text-center">
                    <div className="p-4 bg-green-50 text-green-700 rounded-lg text-sm">
                      One-Tap Login using your GPS Location (Geo-fencing).
                    </div>
                    <div className="space-y-2 text-left">
                      <Label htmlFor="gps-email">Email</Label>
                      <Input
                        id="gps-email"
                        type="email"
                        placeholder="user@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button onClick={handleGpsLogin} className="w-full bg-green-600 hover:bg-green-700" disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Login with GPS'}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signup">
          {/* Signup form remains mostly same, just updating style/structure if needed, 
              but existing code was fine. I'll just copy it back or keep it simple. */}
          <Card>
            <CardHeader>
              <CardTitle>Sign Up</CardTitle>
              <CardDescription>
                Create a new account to get started.
              </CardDescription>
            </CardHeader>
            <form action={handleSignup}>
              <CardContent className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" name="name" type="text" placeholder="John Doe" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input id="dob" name="dob" type="date" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" name="email" type="email" placeholder="user@example.com" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="flex items-center gap-2">
                    <Input id="signup-password" name="password" type={viewPassword ? "text" : "password"} placeholder='********' required />
                    <Button type="button" onClick={() => setViewPassword(!viewPassword)} className="w-10 h-10">
                      {viewPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing up...' : 'Sign Up'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
