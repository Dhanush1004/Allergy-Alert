import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Scan, History, LogOut, AlertCircle } from "lucide-react";
import axios from "axios";
import { API } from "@/App";
import { toast } from "sonner";

export default function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [profileRes, historyRes] = await Promise.all([
        axios.get(`${API}/profile`, { headers }),
        axios.get(`${API}/history`, { headers })
      ]);

      setProfile(profileRes.data);
      setRecentScans(historyRes.data.scans.slice(0, 5));
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "severe": return "text-red-600";
      case "moderate": return "text-orange-600";
      case "mild": return "text-yellow-600";
      default: return "text-green-600";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <nav className="bg-white shadow-sm border-b" data-testid="dashboard-nav">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#667eea' }}>AllergyAlert</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-700" data-testid="user-name">Hi, {user?.name}</span>
            <Button variant="outline" size="sm" onClick={onLogout} data-testid="logout-button">
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>Welcome Back!</h2>
          <p className="text-gray-600">Keep your food safe with intelligent allergy detection</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/profile-setup')} data-testid="nav-profile-card">
            <CardHeader>
              <CardTitle className="flex items-center" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <User className="w-5 h-5 mr-2 text-purple-600" />
                Allergy Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{profile?.allergens?.length || 0}</p>
              <p className="text-sm text-gray-600">Allergens tracked</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/scan')} data-testid="nav-scan-card">
            <CardHeader>
              <CardTitle className="flex items-center" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <Scan className="w-5 h-5 mr-2 text-green-600" />
                Scan Product
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-green-600 hover:bg-green-700" data-testid="scan-now-button">
                Scan Now
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/history')} data-testid="nav-history-card">
            <CardHeader>
              <CardTitle className="flex items-center" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <History className="w-5 h-5 mr-2 text-blue-600" />
                Scan History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{recentScans.length}</p>
              <p className="text-sm text-gray-600">Recent scans</p>
            </CardContent>
          </Card>
        </div>

        {recentScans.length > 0 && (
          <Card data-testid="recent-scans-card">
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Manrope, sans-serif' }}>Recent Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentScans.map((scan, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg" data-testid={`recent-scan-${idx}`}>
                    <div className="flex-1">
                      <h3 className="font-semibold">{scan.product_name}</h3>
                      <p className="text-sm text-gray-600">
                        {scan.allergens_detected.length > 0
                          ? `Allergens: ${scan.allergens_detected.join(", ")}`
                          : "No allergens detected"}
                      </p>
                    </div>
                    <div className={`font-semibold ${getSeverityColor(scan.severity)}`} data-testid={`scan-severity-${idx}`}>
                      {scan.severity === "safe" ? "✓ Safe" : `⚠ ${scan.severity}`}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && (!profile?.allergens || profile.allergens.length === 0) && (
          <Card className="border-orange-200 bg-orange-50" data-testid="setup-prompt-card">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-4">
                <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">Set Up Your Allergy Profile</h3>
                  <p className="text-gray-700 mb-4">
                    To get started with scanning products, please set up your allergy profile first.
                  </p>
                  <Button onClick={() => navigate('/profile-setup')} data-testid="setup-profile-button">
                    Set Up Profile
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}