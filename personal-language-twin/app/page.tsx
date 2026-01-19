'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { UploadIcon, SparklesIcon, BarChart3Icon } from 'lucide-react';

export default function Home() {
  const [writingSamples, setWritingSamples] = useState<string[]>([]);
  const [currentSample, setCurrentSample] = useState('');
  const [styleStrength, setStyleStrength] = useState(0);
  const [driftScore, setDriftScore] = useState<number | null>(null);

  const handleAddSample = () => {
    if (currentSample.trim()) {
      setWritingSamples([...writingSamples, currentSample]);
      setCurrentSample('');
      // Simulate style strength increase
      setStyleStrength(Math.min(100, styleStrength + 20));
    }
  };

  const handleGenerate = async () => {
    // Simulate API call to generate text in user's style
    setDriftScore(Math.random() * 0.3 + 0.7); // Random score between 0.7-1.0
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">3viltwin AI</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Your personalized AI writing assistant that learns and mimics your unique voice and style
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Training Section */}
          <div className="space-y-8">
            {/* Style Strength Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3Icon className="h-5 w-5" />
                  Your Writing Style Strength
                </CardTitle>
                <CardDescription>
                  The more samples you provide, the better your AI twin will understand your voice
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Style Learning Progress</span>
                    <span className="text-sm font-medium">{styleStrength}%</span>
                  </div>
                  <Progress value={styleStrength} className="h-2" />
                </div>
                
                <div className="mt-6 space-y-4">
                  <Textarea
                    placeholder="Paste a sample of your writing here (minimum 100 words recommended)..."
                    value={currentSample}
                    onChange={(e) => setCurrentSample(e.target.value)}
                    rows={6}
                  />
                  <Button onClick={handleAddSample} className="w-full">
                    <UploadIcon className="h-4 w-4 mr-2" />
                    Add Writing Sample
                  </Button>
                </div>
                
                <div className="mt-6">
                  <h3 className="font-medium mb-2">Added Samples ({writingSamples.length})</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {writingSamples.map((sample, index) => (
                      <div key={index} className="text-sm p-2 bg-gray-50 rounded-md">
                        {sample.substring(0, 80)}...
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Style Metrics Card */}
            <Card>
              <CardHeader>
                <CardTitle>Style Metrics</CardTitle>
                <CardDescription>Your writing characteristics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">8.4/10</div>
                    <div className="text-sm text-blue-600">Formality Level</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">127</div>
                    <div className="text-sm text-green-600">Avg. Sentence Length</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-700">1.2k</div>
                    <div className="text-sm text-purple-600">Unique Words</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-orange-700">73%</div>
                    <div className="text-sm text-orange-600">Positive Tone</div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Signature Phrases</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">In my opinion</Badge>
                    <Badge variant="secondary">As mentioned earlier</Badge>
                    <Badge variant="secondary">On the other hand</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Generation Section */}
          <div className="space-y-8">
            {/* AI Composer Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SparklesIcon className="h-5 w-5" />
                  AI Composer
                </CardTitle>
                <CardDescription>Write in your voice with AI assistance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    placeholder="Enter your prompt here (e.g., 'Write an apology email for being late')..."
                    rows={4}
                  />
                  
                  <Button onClick={handleGenerate} className="w-full bg-indigo-600 hover:bg-indigo-700">
                    <SparklesIcon className="h-4 w-4 mr-2" />
                    Write in My Voice
                  </Button>
                  
                  {driftScore !== null && (
                    <div className="mt-4 p-4 rounded-lg border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">Style Drift Detection</span>
                        <Badge 
                          variant={driftScore > 0.85 ? "default" : driftScore > 0.75 ? "secondary" : "destructive"}
                        >
                          {driftScore > 0.85 ? "Good" : driftScore > 0.75 ? "Medium" : "High Drift"}
                        </Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className={`h-2.5 rounded-full ${
                            driftScore > 0.85 ? "bg-green-500" : 
                            driftScore > 0.75 ? "bg-yellow-500" : "bg-red-500"
                          }`} 
                          style={{ width: `${driftScore * 100}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Similarity to your writing style: {(driftScore * 100).toFixed(1)}%
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Generated Text</h4>
                    <div className="p-4 bg-gray-50 rounded-md min-h-[120px]">
                      {driftScore !== null 
                        ? "Dear [Recipient], I wanted to reach out and sincerely apologize for being late to our meeting yesterday. I understand that punctuality is important and I regret any inconvenience this may have caused. My intention was to arrive on time, however, unforeseen circumstances prevented me from doing so. I value our relationship and our time together, and I assure you that this will not happen again. Thank you for your understanding." 
                        : "Your generated text will appear here..."}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Style Inspector Card */}
            <Card>
              <CardHeader>
                <CardTitle>Style Inspector</CardTitle>
                <CardDescription>See where your AI twin may drift from your style</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <div className="mr-3 mt-1">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div>
                      <div className="font-medium">Sentence Structure Match</div>
                      <div className="text-sm text-gray-600">Your AI twin uses similar sentence patterns</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="mr-3 mt-1">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    </div>
                    <div>
                      <div className="font-medium">Vocabulary Choice</div>
                      <div className="text-sm text-gray-600">Some formal terms differ from your usual style</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="mr-3 mt-1">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div>
                      <div className="font-medium">Tone Consistency</div>
                      <div className="text-sm text-gray-600">Maintains your respectful and professional tone</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}