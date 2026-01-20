'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

export default function Home() {
  const [writingSamples, setWritingSamples] = useState<string[]>([]);
  const [currentSample, setCurrentSample] = useState('');
  const [styleStrength, setStyleStrength] = useState(0);
  const [driftScore, setDriftScore] = useState<number | null>(null);
  const [formalityLevel, setFormalityLevel] = useState(0);
  const [avgSentenceLength, setAvgSentenceLength] = useState(0);
  const [uniqueWords, setUniqueWords] = useState(0);
  const [positiveTone, setPositiveTone] = useState(0);
  const [signaturePhrases, setSignaturePhrases] = useState<string[]>([]);
  const [conversation, setConversation] = useState<{role: string, content: string}[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string>('user-123'); // In a real app, this would come from auth

  // Initialize metrics to 0 and gradually increase them
  useEffect(() => {
    if (styleStrength === 0 && writingSamples.length === 0) {
      // Initialize all metrics to 0
      setFormalityLevel(0);
      setAvgSentenceLength(0);
      setUniqueWords(0);
      setPositiveTone(0);
      setSignaturePhrases([]);
    }
  }, [styleStrength, writingSamples.length]);

  const handleAddSample = async () => {
    if (currentSample.trim() && currentSample.length > 50) { // Require minimum length
      setIsLoading(true);
      try {
        // Call API to process the sample and update metrics
        const response = await fetch('/api/process-sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, rawText: currentSample })
        });

        const result = await response.json();

        if (result.success) {
          setWritingSamples([...writingSamples, currentSample]);
          setCurrentSample('');

          // Update metrics based on API response
          if (result.metrics) {
            setFormalityLevel(result.metrics.formalityLevel);
            setAvgSentenceLength(result.metrics.avgSentenceLength);
            setUniqueWords(result.metrics.uniqueWords);
            setPositiveTone(result.metrics.positiveTone);
            setSignaturePhrases(result.metrics.commonPhrases);
          }

          // Gradually increase style strength
          setStyleStrength(prev => Math.min(100, prev + 20));
        }
      } catch (error) {
        console.error('Error processing sample:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      // Get the prompt from the textarea in the generation section
      const promptTextarea = document.querySelector('#generation-prompt') as HTMLTextAreaElement;
      const prompt = promptTextarea?.value || 'Write an apology email for being late';

      const response = await fetch('/api/style-twin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, prompt })
      });

      const result = await response.json();

      if (result.success) {
        // Check drift
        const driftResponse = await fetch('/api/drift-detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, generatedText: result.generatedText })
        });

        const driftResult = await driftResponse.json();

        if (driftResult.success) {
          setDriftScore(driftResult.driftScore);
        }

        // Add to conversation
        setConversation(prev => [...prev,
          {role: 'user', content: prompt},
          {role: 'assistant', content: result.generatedText}
        ]);
      }
    } catch (error) {
      console.error('Error generating text:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatSubmit = async () => {
    if (userInput.trim()) {
      setIsLoading(true);
      setConversation(prev => [...prev, {role: 'user', content: userInput}]);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            message: userInput,
            conversationHistory: conversation
          })
        });

        const result = await response.json();

        if (result.success) {
          setConversation(prev => [...prev, {role: 'assistant', content: result.response}]);
        }
      } catch (error) {
        console.error('Error in chat:', error);
        setConversation(prev => [...prev, {role: 'assistant', content: 'Sorry, I encountered an error. Please try again.'}]);
      } finally {
        setUserInput('');
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-white py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">3viltwin AI</h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Your personalized AI writing assistant that learns and mimics your unique voice and style
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Training Section */}
          <div className="space-y-6">
            {/* Style Strength Card */}
            <Card>
              <CardHeader>
                <CardTitle>Your Writing Style Strength</CardTitle>
                <CardDescription>
                  The more samples you provide, the better your AI twin will understand your voice
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Learning Progress</span>
                    <span className="text-sm font-medium">{styleStrength}%</span>
                  </div>
                  <Progress value={styleStrength} className="h-2" />
                </div>

                <div className="mt-4 space-y-3">
                  <Textarea
                    placeholder="Paste a sample of your writing here (minimum 100 words recommended)..."
                    value={currentSample}
                    onChange={(e) => setCurrentSample(e.target.value)}
                    rows={4}
                  />
                  <Button
                    onClick={handleAddSample}
                    className="w-full"
                    disabled={isLoading || currentSample.length < 50}
                  >
                    {isLoading ? 'Processing...' : 'Add Writing Sample'}
                  </Button>
                </div>

                <div className="mt-4">
                  <h3 className="font-medium mb-2">Samples ({writingSamples.length})</h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto text-sm">
                    {writingSamples.map((sample, index) => (
                      <div key={index} className="p-2 bg-gray-50 rounded">
                        {sample.substring(0, 60)}...
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="border rounded p-3">
                    <div className="text-xl font-bold text-gray-800">{formalityLevel.toFixed(1)}/10</div>
                    <div className="text-xs text-gray-600">Formality</div>
                  </div>
                  <div className="border rounded p-3">
                    <div className="text-xl font-bold text-gray-800">{avgSentenceLength}</div>
                    <div className="text-xs text-gray-600">Avg. Length</div>
                  </div>
                  <div className="border rounded p-3">
                    <div className="text-xl font-bold text-gray-800">{uniqueWords}</div>
                    <div className="text-xs text-gray-600">Unique Words</div>
                  </div>
                  <div className="border rounded p-3">
                    <div className="text-xl font-bold text-gray-800">{positiveTone.toFixed(0)}%</div>
                    <div className="text-xs text-gray-600">Positive Tone</div>
                  </div>
                </div>

                <div className="mt-3">
                  <h4 className="font-medium mb-1 text-sm">Signature Phrases</h4>
                  <div className="flex flex-wrap gap-1">
                    {signaturePhrases.length > 0 ? signaturePhrases.map((phrase, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">{phrase}</Badge>
                    )) : <span className="text-xs text-gray-500">No phrases detected yet</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Generation Section */}
          <div className="space-y-6">
            {/* AI Chat Card */}
            <Card>
              <CardHeader>
                <CardTitle>Chat with Your Evil Twin</CardTitle>
                <CardDescription>Have a conversation with your AI twin</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="h-40 overflow-y-auto p-3 bg-gray-50 rounded mb-2 text-sm">
                    {conversation.length > 0 ? (
                      conversation.map((msg, index) => (
                        <div key={index} className={`mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                          <div className={`inline-block p-2 rounded ${msg.role === 'user' ? 'bg-blue-100' : 'bg-gray-200'}`}>
                            <span className="font-medium">{msg.role === 'user' ? 'You: ' : 'Evil Twin: '}</span>
                            {msg.content}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 italic">Start a conversation with your evil twin...</p>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="Message your evil twin..."
                      className="flex-1 border rounded px-3 py-2 text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleChatSubmit()}
                      disabled={isLoading}
                    />
                    <Button
                      onClick={handleChatSubmit}
                      className="px-3"
                      disabled={isLoading}
                    >
                      {isLoading ? '...' : 'Send'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Generator Card */}
            <Card>
              <CardHeader>
                <CardTitle>AI Writer</CardTitle>
                <CardDescription>Generate text in your voice</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Textarea
                    id="generation-prompt"
                    placeholder="Enter your prompt here (e.g., 'Write an apology email for being late')..."
                    rows={3}
                  />

                  <Button
                    onClick={handleGenerate}
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Generating...' : 'Write in My Voice'}
                  </Button>

                  {driftScore !== null && (
                    <div className="mt-3 p-3 rounded border text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">Style Match</span>
                        <Badge
                          variant={driftScore > 0.85 ? "default" : driftScore > 0.75 ? "secondary" : "destructive"}
                        >
                          {driftScore > 0.85 ? "Strong" : driftScore > 0.75 ? "Moderate" : "Weak"}
                        </Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            driftScore > 0.85 ? "bg-green-500" :
                            driftScore > 0.75 ? "bg-yellow-500" : "bg-red-500"
                          }`}
                          style={{ width: `${driftScore * 100}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Match: {(driftScore * 100).toFixed(1)}%
                      </div>
                    </div>
                  )}

                  <div className="mt-3">
                    <h4 className="font-medium mb-1 text-sm">Generated Text</h4>
                    <div className="p-3 bg-gray-50 rounded text-sm min-h-[100px]">
                      {conversation.filter(msg => msg.role === 'assistant').pop()?.content || "Your generated text will appear here..."}
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