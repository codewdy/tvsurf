import asyncio
from aiohttp import ClientSession, ClientConnectorError
from service.schema.api import Echo

async def test_echo_client():
    """测试客户端：访问 echo API"""
    async with ClientSession() as session:
        # 构造请求数据
        request_data = Echo.Request(message="Hello, Echo API!")
        url = "http://localhost:9399/api/echo"
        
        try:
            async with session.post(url, json=request_data.model_dump()) as resp:
                if resp.status == 200:
                    response_text = await resp.text()
                    response_data = Echo.Response.model_validate_json(response_text)
                    print(f"✓ Echo API 测试成功!")
                    print(f"  发送消息: {request_data.message}")
                    print(f"  接收消息: {response_data.message}")
                else:
                    print(f"✗ Echo API 测试失败，状态码: {resp.status}")
                    print(f"  响应内容: {await resp.text()}")
        except ClientConnectorError as e:
            print(f"✗ 无法连接到服务器: {e}")
            print(f"  请确保服务已启动: python service/main.py")
        except Exception as e:
            print(f"✗ Echo API 测试出错: {e}")

if __name__ == "__main__":
    asyncio.run(test_echo_client())

