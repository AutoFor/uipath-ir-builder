// Coded のオブジェクトリポジトリ（ObjectRepository.cs → Descriptors の名前）のテスト
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDescriptors } from "./coded-descriptors.ts";

// Studio が作る ObjectRepository.cs を短くしたもの（moneyforward_cs の形。入れ子の要素 Top > Consent を含む）
const SRC = `using UiPath.CodedWorkflows.DescriptorIntegration;

namespace Proj.ObjectRepository
{
    public static class Descriptors
    {
        public static class Chrome_ID
        {
            static string _reference = "LIB/app";
            public static _Implementation._Chrome_ID.__Login Login { get; private set; } = new _Implementation._Chrome_ID.__Login();
        }
    }
}

namespace Proj._Implementation
{
    namespace _Chrome_ID
    {
        public class __Login : IScreenDescriptor
        {
            public __Login()
            {
                _screenDescriptor = new ScreenDescriptorDefinition
                {
                    Reference = "LIB/scr",
                    DisplayName = "Login",
                    Screen = this
                };
            }

            public _Implementation._Chrome_ID._Login.__メール Email { get; private set; }
            public _Implementation._Chrome_ID._Login.__Top Top { get; private set; }
        }
    }

    namespace _Chrome_ID._Login
    {
        public class __メール : IElementDescriptor
        {
            public __メール(IScreenDescriptor s, IElementDescriptor p)
            {
                _elementDescriptor = new ElementDescriptorDefinition
                {
                    Reference = "LIB/mail",
                };
            }
        }
    }

    namespace _Chrome_ID._Login
    {
        public class __Top : IElementDescriptor
        {
            public __Top(IScreenDescriptor s, IElementDescriptor p)
            {
                _elementDescriptor = new ElementDescriptorDefinition
                {
                    Reference = "LIB/top",
                };
            }

            public _Implementation._Chrome_ID._Login._Top.__Consent Consent { get; private set; }
        }
    }

    namespace _Chrome_ID._Login._Top
    {
        public class __Consent : IElementDescriptor
        {
            public __Consent(IScreenDescriptor s, IElementDescriptor p)
            {
                _elementDescriptor = new ElementDescriptorDefinition
                {
                    Reference = "LIB/consent",
                };
            }
        }
    }
}
`.replace(/\n/g, "\r\n"); // Studio のファイルは CRLF

test("Reference から Descriptors の名前を引ける（アプリ・画面・要素・入れ子の要素）", () => {
  const d = parseDescriptors(SRC);
  assert.deepEqual(d.get("LIB/app"), { path: "Descriptors.Chrome_ID", kind: "app", namespace: "Proj" });
  assert.deepEqual(d.get("LIB/scr"), { path: "Descriptors.Chrome_ID.Login", kind: "screen", namespace: "Proj" });
  assert.equal(d.get("LIB/mail")?.path, "Descriptors.Chrome_ID.Login.Email");
  assert.equal(d.get("LIB/consent")?.path, "Descriptors.Chrome_ID.Login.Top.Consent");
  assert.equal(d.get("LIB/consent")?.kind, "element");
});
