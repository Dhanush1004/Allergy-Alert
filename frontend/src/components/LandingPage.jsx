import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Scan, History, AlertTriangle } from "lucide-react";
import axios from "axios";
import { API } from "@/App";
import { toast } from "sonner";

export default function LandingPage({ onAuth }) {
  const [showAuth, setShowAuth] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !name) {
      toast.error("Please fill all fields");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/register`, { email, password, name });
      toast.success("Welcome to AllergyAlert!");
      onAuth(res.data.token, res.data.user);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error("Please fill all fields");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login`, { email, password });
      toast.success("Welcome back!");
      onAuth(res.data.token, res.data.user);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  if (showAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <Card className="w-full max-w-md backdrop-blur-md bg-white/95 shadow-2xl" data-testid="auth-card">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center" style={{ fontFamily: 'Manrope, sans-serif' }}>AllergyAlert</CardTitle>
            <CardDescription className="text-center">Your personal food safety companion</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" data-testid="login-tab">Login</TabsTrigger>
                <TabsTrigger value="register" data-testid="register-tab">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login" data-testid="login-form">
                <div className="space-y-4">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="login-email-input"
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="login-password-input"
                  />
                  <Button
                    className="w-full"
                    onClick={handleLogin}
                    disabled={loading}
                    data-testid="login-submit-button"
                  >
                    {loading ? "Logging in..." : "Login"}
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="register" data-testid="register-form">
                <div className="space-y-4">
                  <Input
                    type="text"
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="register-name-input"
                  />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="register-email-input"
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="register-password-input"
                  />
                  <Button
                    className="w-full"
                    onClick={handleRegister}
                    disabled={loading}
                    data-testid="register-submit-button"
                  >
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="landing-title">
            AllergyAlert
          </h1>
          <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Intelligent food allergy detection using AI and ingredient analysis. Scan products instantly and stay safe.
          </p>
          <Button
            size="lg"
            className="bg-white text-purple-700 hover:bg-gray-100 text-lg px-8 py-6 rounded-full shadow-xl"
            onClick={() => setShowAuth(true)}
            data-testid="get-started-button"
          >
            Get Started
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="bg-white/95 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-shadow" data-testid="feature-scan">
            <CardHeader>
              <Scan className="w-12 h-12 text-purple-600 mb-3" />
              <CardTitle className="text-xl" style={{ fontFamily: 'Manrope, sans-serif' }}>Smart Scanning</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Scan food labels with AI-powered image recognition or enter ingredients manually</p>
            </CardContent>
          </Card>

          <Card className="bg-white/95 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-shadow" data-testid="feature-detect">
            <CardHeader>
              <ShieldCheck className="w-12 h-12 text-green-600 mb-3" />
              <CardTitle className="text-xl" style={{ fontFamily: 'Manrope, sans-serif' }}>Instant Detection</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Detect allergens instantly from your personalized profile with severity alerts</p>
            </CardContent>
          </Card>

          <Card className="bg-white/95 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-shadow" data-testid="feature-alert">
            <CardHeader>
              <AlertTriangle className="w-12 h-12 text-orange-600 mb-3" />
              <CardTitle className="text-xl" style={{ fontFamily: 'Manrope, sans-serif' }}>Safety Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Get clear warnings with mild, moderate, or severe severity classifications</p>
            </CardContent>
          </Card>

          <Card className="bg-white/95 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-shadow" data-testid="feature-history">
            <CardHeader>
              <History className="w-12 h-12 text-blue-600 mb-3" />
              <CardTitle className="text-xl" style={{ fontFamily: 'Manrope, sans-serif' }}>Scan History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Track all scanned products and review past results anytime</p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Card className="max-w-3xl mx-auto bg-white/95 backdrop-blur-sm shadow-2xl">
            <CardHeader>
              <CardTitle className="text-3xl" style={{ fontFamily: 'Manrope, sans-serif' }}>How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-left">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">1</div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Create Your Profile</h3>
                    <p className="text-gray-600">Set up your personalized allergy profile with specific allergens and severity levels</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">2</div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Scan Products</h3>
                    <p className="text-gray-600">Take a photo of food labels or manually enter ingredients for instant analysis</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">3</div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Stay Safe</h3>
                    <p className="text-gray-600">Receive instant alerts about allergens with clear safety recommendations</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}