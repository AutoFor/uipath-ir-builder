using System;
using System.Collections.Generic;
using UiPath.CodedWorkflows;
using UiPath.Core.Activities;

// わざと壊した Coded Workflow。tools/coded/check.ts が検出できることを確かめるためのもの（build は通らない）
namespace WrongNamespace
{
    public class Broken : CodedWorkflow
    {
        public void Execute()
        {
            // コメントや文字列の中の system.NoSuchMethod() は無視される
            var s = "system.NoSuchMethod()";
            Log("あいまい", LogLevel.Warn);                       // LOGLEVEL_AMBIGUOUS
            system.WriteTextFile("text");                          // NO_OVERLOAD（file が無い）
            system.WriteTextFile("text", "out.txt");               // ARG_TYPE（文字列を ILocalResource に）
            system.WriteTextFle("text", null);                     // UNKNOWN_METHOD（似た名前を出す）
            system.CombineText(source: new List<string>(), sep: ","); // NO_OVERLOAD（sep という引数は無い）
            var file = (LocalResource)null;                        // MISSING_USING
            var r = system.GetResourceForLocalPath("a.txt", 1);    // LOCAL_RESOURCE と ARG_TYPE
            Log($"補間 {system.FileExists("a.txt", 2, 3)} も見る"); // 補間の中も見る
            system.DownloadFileFromURLAsync("http://example.com"); // ASYNC_NOT_AWAITED
            Console.WriteLine("x");                                // CONSOLE
            uiAutomation.Clik("x");                                // UNKNOWN_METHOD
            mail.Anything();                                       // NO_CATALOG（警告だけ）
        }
    }
}
