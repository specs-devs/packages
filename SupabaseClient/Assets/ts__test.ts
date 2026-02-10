import { createClient } from 'SupabaseClient.lspkg/supabase-snapcloud'
import { type SupabaseClient } from 'SupabaseClient.lspkg/supabase-snapcloud'
import { Database } from 'DatabaseTypes'

function formatTime(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[date.getMonth()];
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${month} ${day} ${hours}:${minutes}:${seconds}`;
}

@component
export class NewScript extends BaseScriptComponent {
    
    @input
    supabaseProject: SupabaseProject

    @input
    texture: Texture;
    
    private supabaseClient: SupabaseClient;
    
    async onAwake() {
        this.supabaseClient = createClient<Database>(this.supabaseProject.url, this.supabaseProject.publicToken);
        await this.runTests();
    }
    
    async runTests() {
        const tests = [
            { name: 'testSignIn', func: () => this.testSignIn() },
            { name: 'testGetUser', func: () => this.testGetUser() },
            { name: 'testEdgeFunctions0args', func: () => this.testEdgeFunctions0args() },
            { name: 'testEdgeFunctions1args', func: () => this.testEdgeFunctions1args() },
            { name: 'testEdgeFunctions2args', func: () => this.testEdgeFunctions2args() },
            { name: 'testSelectFromTable', func: () => this.testSelectFromTable() },
            { name: 'testInsertIntoTable', func: () => this.testInsertIntoTable() },
            { name: 'testUpdateTable', func: () => this.testUpdateTable() },
            { name: 'testSelectDeleteFromTable', func: () => this.testSelectDeleteFromTable() },
            { name: 'testUploadFile', func: () => this.testUploadFileUint8Array() },
            { name: 'testUploadFile', func: () => this.testUploadFileBlob() },
            { name: 'testDownloadFile', func: () => this.testDownloadFile() },
            { name: 'testDeleteFile', func: () => this.testDeleteFile() }
        ];

        let passed = 0;
        let failed = 0;

        for (const test of tests) {
            const result = await this.test(test.func, test.name);
            if (result) {
                passed++;
            } else {
                failed++;
            }
        }

        const total = tests.length;
        console.log(`=== Test Summary ===`);
        console.log(`Total tests run: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Success rate: ${((passed / total) * 100).toFixed(1)}%`);
    }
    
    private createTestDescription(testName: string): string {
        const prefix = '---- ';
        const suffix = ' ';
        const totalLength = 80;
        const nameLength = testName.length;
        const fixedLength = prefix.length + suffix.length + nameLength;
        const dashesNeeded = totalLength - fixedLength;
        const dashes = '-'.repeat(Math.max(0, dashesNeeded));
        return prefix + testName + suffix + dashes;
    }

    async test(func: () => Promise<{data: any, error: any}>, testName?: string): Promise<boolean> {
        const name = testName || func.name || 'Unknown Test';
        console.log(this.createTestDescription(name));
        const {data, error} = await func();
        if (error) {
            console.log('FAIL: ' + JSON.stringify(error));
            return false;
        } else {
            console.log('PASS: ' + JSON.stringify(data));
            return true;
        }
    }
    
    async testSignIn() {
        return await this.supabaseClient.auth.signInWithSnapchat();
    }
    
    async testEdgeFunctions0args() {
        return await this.supabaseClient.functions.invoke('echo-client-info');
    }
    
    async testEdgeFunctions1args() {
        return await this.supabaseClient.functions.invoke('double-int', { 
            body: { x: 5 }
        });
    }
    
    async testEdgeFunctions2args() {
        return await this.supabaseClient.functions.invoke('sum-x-y', { 
            body: { x: 29, y: 13 }
        });
    }
    
    async testGetUser() {
        return await this.supabaseClient.auth.getUser();
    }
    
    async testSelectFromTable() {
        return await this.supabaseClient.from('test_table').select('id');
    }
    
    async testInsertIntoTable() {
        return await this.supabaseClient.from('test_table').insert({message: 'Hello, World!'});
    }
    
    async testUpdateTable() {
        return await this.supabaseClient.from('test_table').update({message: 'Hello, World!'}).eq('id', 1);
    }
    
    async testSelectDeleteFromTable() {
        const { data, error } = await this.supabaseClient.from('test_table').select('id').order('created_at', { ascending: false }).limit(1);
        if (error) {
            console.error('Error fetching latest row:', error);
            return;
        }
        return await this.supabaseClient.from('test_table').delete().eq('id', data[0].id);
    }
    
    async testUploadFileUint8Array(): Promise<{data: any, error: any}> {
        return await new Promise<{data: any, error: any}>((resolve) => {
            (this.texture.control as TextProvider).text = '[Uint8Array] ' + formatTime(new Date());
            (this.texture.control as TextProvider).textColor = new vec4(1, 0, 0, 1);
            Base64.encodeTextureAsync(
                this.texture,
                async (encodedTexture: string) => {
                    try {
                        const data = Base64.decode(encodedTexture);
                        const result = await this.supabaseClient
                            .storage
                            .from('test')
                            .upload('uint8array-text-texture.jpg', data, { contentType: 'image/jpg', upsert: true });
                        resolve(result as unknown as {data: any, error: any});
                    } catch (e) {
                        resolve({ data: null, error: e });
                    }
                },
                () => {
                    resolve({ data: null, error: { message: 'Failed to encode texture' } });
                },
                CompressionQuality.MaximumQuality,
                EncodingType.Jpg,
            );
        });
    }
    
        async testUploadFileBlob(): Promise<{data: any, error: any}> {
        return await new Promise<{data: any, error: any}>((resolve) => {
            (this.texture.control as TextProvider).text = ' [Blob] ' + formatTime(new Date());
            (this.texture.control as TextProvider).textColor = new vec4(0, 0, 1, 1);
            Base64.encodeTextureAsync(
                this.texture,
                async (encodedTexture: string) => {
                    try {
                        const data = Base64.decode(encodedTexture);
                        // @ts-ignore
                        const blob = new Blob([data], { type: "image/jpeg" });
                        const result = await this.supabaseClient
                            .storage
                            .from('test')
                            .upload('blob-text-texture.jpg', blob, { contentType: 'image/jpg', upsert: true });
                        resolve(result as unknown as {data: any, error: any});
                    } catch (e) {
                        resolve({ data: null, error: e });
                    }
                },
                () => {
                    resolve({ data: null, error: { message: 'Failed to encode texture' } });
                },
                CompressionQuality.MaximumQuality,
                EncodingType.Jpg,
            );
        });
    }

    async testDownloadFile() {
        return await this.supabaseClient
           .storage
           .from('test')
           .download('blob-text-texture.jpg');
    }
    
    async testDeleteFile() {
        return await this.supabaseClient
           .storage
           .from('test')
           .remove(['icon.png']);
    }
}
