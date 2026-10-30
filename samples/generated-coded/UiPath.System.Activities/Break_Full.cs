using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Break_Full）から生成。手で直さず IR を直す
    public class Break_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 i = default;
            List<Int32> items = new List<int>() { 1, 2, 3, 4 };
            var __loop1 = -1;
            while (true)
            {
                __loop1++;
                i = i + 1;
                if (i > 2)
                {
                    // 3回目で抜ける
                    break;
                }
                Log(message: "i=" + i.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            }
            var __loop2 = -1;
            do
            {
                __loop2++;
                Log(message: "DoWhile の中", level: UiPath.CodedWorkflows.LogLevel.Info);
                break;
            } while (true);
            foreach (Int32 it in items)
            {
                if (it > 1)
                {
                    break;
                }
                Log(message: "ForEach: " + it.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            }
            Log(message: "ループの後", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
