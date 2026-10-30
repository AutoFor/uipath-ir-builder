using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ExtractText_Full）から生成。手で直さず IR を直す
    public class ExtractText_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String first = default;
            IEnumerable<String> all = default;
            IEnumerable<String> mails = default;
            IEnumerable<String> urls = default;
            // 2つの文字列の間
            {
                IEnumerable<string> __found;
                if (true) __found = system.ExtractTextOccurrences("<A>x</A><a>y</a><A>x</A>", "<A>", "</A>", true, true);
                else if (false) __found = system.ExtractEmails("<A>x</A><a>y</a><A>x</A>", true);
                else if (false) __found = system.ExtractUrls("<A>x</A><a>y</a><A>x</A>", false, true);
                else __found = new[] { system.ExtractTextFromHTML("<A>x</A><a>y</a><A>x</A>") };
                all = __found;
                first = __found.FirstOrDefault();
            }
            // メールアドレス
            {
                IEnumerable<string> __found;
                if (false) __found = system.ExtractTextOccurrences("連絡先 a@example.com と b@example.org と a@example.com", null, null, true, false);
                else if (true) __found = system.ExtractEmails("連絡先 a@example.com と b@example.org と a@example.com", true);
                else if (false) __found = system.ExtractUrls("連絡先 a@example.com と b@example.org と a@example.com", false, true);
                else __found = new[] { system.ExtractTextFromHTML("連絡先 a@example.com と b@example.org と a@example.com") };
                mails = __found;
                _ = __found.FirstOrDefault();
            }
            // URL
            {
                IEnumerable<string> __found;
                if (false) __found = system.ExtractTextOccurrences("see https://example.com/path?q=1 and http://foo.org/x", null, null, false, false);
                else if (false) __found = system.ExtractEmails("see https://example.com/path?q=1 and http://foo.org/x", false);
                else if (true) __found = system.ExtractUrls("see https://example.com/path?q=1 and http://foo.org/x", true, false);
                else __found = new[] { system.ExtractTextFromHTML("see https://example.com/path?q=1 and http://foo.org/x") };
                urls = __found;
                _ = __found.FirstOrDefault();
            }
            Log(message: first, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(all.Count().ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(string.Join("|", mails)), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(string.Join("|", urls)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
