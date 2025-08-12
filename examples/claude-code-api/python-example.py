#!/usr/bin/env python3
"""
Claude Code API - Python Example
Transform Claude Code into REST API with AI Terminal
"""

import requests
import json
import time
import asyncio
import aiohttp
from typing import Dict, List, Any, Optional
import sseclient  # pip install sseclient-py

# Configuration
API_BASE_URL = "http://localhost:8082"


class ClaudeCodeAPI:
    """Claude Code API Client for Python"""
    
    def __init__(self, base_url: str = API_BASE_URL):
        self.base_url = base_url
        self.session = requests.Session()
    
    def generate_content(self, topic: str, template: str = "daily-knowledge-card-template.md") -> Dict[str, Any]:
        """
        Generate content using non-streaming API
        
        Args:
            topic: The topic to generate content for
            template: Template file name to use
            
        Returns:
            Generated content as dictionary
        """
        print(f"\n🚀 Generating content for: {topic}")
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/generate/card",
                json={
                    "topic": topic,
                    "templateName": template
                },
                timeout=180  # 3 minutes timeout
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    print(f"✅ Generation successful!")
                    print(f"📁 File: {data['data']['fileName']}")
                    print(f"⏱️ Time: {data['data']['generationTime']}ms")
                    return data["data"]
                else:
                    print(f"❌ Generation failed: {data.get('message')}")
            else:
                print(f"❌ HTTP Error: {response.status_code}")
                
        except requests.exceptions.Timeout:
            print("❌ Request timeout - generation took too long")
        except Exception as e:
            print(f"❌ Error: {str(e)}")
        
        return None
    
    def generate_content_streaming(self, topic: str, template: str = "daily-knowledge-card-template.md"):
        """
        Generate content using streaming API (Server-Sent Events)
        
        Args:
            topic: The topic to generate content for
            template: Template file name to use
            
        Yields:
            Stream events as they arrive
        """
        print(f"\n🌊 Starting streaming generation for: {topic}")
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/generate/card/stream",
                json={
                    "topic": topic,
                    "templateName": template
                },
                stream=True,
                headers={"Accept": "text/event-stream"}
            )
            
            client = sseclient.SSEClient(response)
            
            for event in client.events():
                if event.event == 'output':
                    data = json.loads(event.data)
                    print(f"📝 Output: {data.get('data', '')[:100]}...")
                    yield event
                elif event.event == 'status':
                    data = json.loads(event.data)
                    print(f"📊 Status: {data}")
                    yield event
                elif event.event == 'completed':
                    data = json.loads(event.data)
                    print("✅ Generation complete!")
                    yield event
                    break
                elif event.event == 'error':
                    data = json.loads(event.data)
                    print(f"❌ Error: {data.get('message')}")
                    break
                    
        except Exception as e:
            print(f"❌ Stream Error: {str(e)}")
    
    def batch_generate(self, topics: List[str], template: str = "daily-knowledge-card-template.md") -> List[Dict]:
        """
        Generate multiple contents in batch
        
        Args:
            topics: List of topics to generate
            template: Template file name to use
            
        Returns:
            List of generated contents
        """
        print(f"\n🔄 Batch generating {len(topics)} topics...")
        
        results = []
        for i, topic in enumerate(topics, 1):
            print(f"\n[{i}/{len(topics)}] Processing: {topic}")
            result = self.generate_content(topic, template)
            if result:
                results.append(result)
            time.sleep(1)  # Be nice to the API
        
        print(f"\n✅ Batch complete! Generated {len(results)}/{len(topics)} items")
        return results
    
    async def async_generate(self, topic: str, template: str = "daily-knowledge-card-template.md") -> Dict:
        """
        Async version for concurrent generation
        """
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/api/generate/card",
                json={
                    "topic": topic,
                    "templateName": template
                }
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("data") if data.get("success") else None
        return None
    
    async def concurrent_generate(self, topics: List[str]) -> List[Dict]:
        """
        Generate multiple contents concurrently using async
        """
        print(f"\n⚡ Concurrent generating {len(topics)} topics...")
        
        tasks = [self.async_generate(topic) for topic in topics]
        results = await asyncio.gather(*tasks)
        
        successful = [r for r in results if r is not None]
        print(f"✅ Generated {len(successful)}/{len(topics)} items concurrently")
        
        return successful
    
    def check_health(self) -> bool:
        """Check API health status"""
        try:
            response = self.session.get(f"{self.base_url}/health")
            if response.status_code == 200:
                print("✅ API is healthy")
                return True
        except:
            pass
        
        print("❌ API is down")
        return False


def example_custom_integration():
    """Example: Integrate Claude Code API into your application"""
    
    class ContentGenerator:
        def __init__(self):
            self.api = ClaudeCodeAPI()
        
        def generate_blog_post(self, topic: str) -> str:
            """Generate a blog post using Claude Code API"""
            content = self.api.generate_content(
                topic=topic,
                template="blog-post-template.md"
            )
            
            if content:
                # Process the content for your blog
                return self.format_for_blog(content)
            return None
        
        def format_for_blog(self, content: Dict) -> str:
            """Format Claude output for blog publishing"""
            # Extract and format content
            json_content = content.get("content", {})
            
            blog_html = f"""
            <article>
                <h1>{json_content.get('title', '')}</h1>
                <div class="content">
                    {json_content.get('body', '')}
                </div>
                <div class="tags">
                    {json_content.get('tags', '')}
                </div>
            </article>
            """
            return blog_html
    
    # Use the content generator
    generator = ContentGenerator()
    blog_post = generator.generate_blog_post("Python Type Hints")
    if blog_post:
        print("\n📝 Blog post generated successfully!")
        print(blog_post[:500] + "...")


def example_webhook_integration():
    """Example: Use Claude Code API with webhooks"""
    
    def process_webhook_request(request_data: Dict) -> Dict:
        """Process incoming webhook and generate content"""
        
        api = ClaudeCodeAPI()
        
        # Extract topic from webhook payload
        topic = request_data.get("topic")
        callback_url = request_data.get("callback_url")
        
        # Generate content
        content = api.generate_content(topic)
        
        if content and callback_url:
            # Send result back to webhook
            requests.post(callback_url, json={
                "status": "completed",
                "content": content
            })
            
        return {
            "status": "processing",
            "message": f"Generating content for: {topic}"
        }


def main():
    """Run examples"""
    print("🎯 Claude Code API - Python Examples")
    print("=" * 40)
    
    # Initialize API client
    api = ClaudeCodeAPI()
    
    # Check API health
    if not api.check_health():
        print("Please make sure AI Terminal is running on port 8082")
        return
    
    # Example 1: Simple generation
    print("\n1️⃣ Simple Generation")
    content = api.generate_content("Python Decorators")
    if content:
        print(json.dumps(content, indent=2)[:500] + "...")
    
    # Example 2: Streaming generation
    print("\n2️⃣ Streaming Generation")
    for event in api.generate_content_streaming("JavaScript Async/Await"):
        pass  # Events are printed in the generator
    
    # Example 3: Batch generation
    print("\n3️⃣ Batch Generation")
    topics = ["React Hooks", "Vue 3 Composition API", "Svelte Stores"]
    results = api.batch_generate(topics)
    
    # Example 4: Concurrent generation (async)
    print("\n4️⃣ Concurrent Generation")
    topics = ["Docker", "Kubernetes", "Terraform"]
    loop = asyncio.get_event_loop()
    results = loop.run_until_complete(api.concurrent_generate(topics))
    
    # Example 5: Custom integration
    print("\n5️⃣ Custom Integration Example")
    example_custom_integration()


if __name__ == "__main__":
    main()