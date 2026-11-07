// <cstdlib> comes first so glibc's <features.h> defines __GLIBC__ before the
// check below.
#include <cstdlib>
#include <napi.h>

#if defined(__GLIBC__)
#include <malloc.h>
#endif

namespace photostructure::heap_trim {

// Asks the C allocator to return free pages to the operating system.
//
// glibc's free() shrinks the heap only from its top, so pages freed below a
// live allocation stay resident. malloc_trim(0) releases those free pages in
// every arena. It returns 1 if it found a whole free page to madvise() away,
// without checking whether that page was still resident, so a second call
// right after the first also returns 1.
//
// src/index.ts loads this addon only on glibc (it explains why). The #else
// branch exists so `npm run lint` and a manual build still compile this file
// on musl, macOS, and Windows.
Napi::Value HeapTrim(const Napi::CallbackInfo &info) {
#if defined(__GLIBC__)
  return Napi::Boolean::New(info.Env(), malloc_trim(0) == 1);
#else
  return Napi::Boolean::New(info.Env(), false);
#endif
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("heapTrim", Napi::Function::New(env, HeapTrim, "heapTrim"));
  return exports;
}

} // namespace photostructure::heap_trim

// NODE_API_MODULE needs an unqualified function name.
Napi::Object InitHeapTrim(Napi::Env env, Napi::Object exports) {
  return photostructure::heap_trim::Init(env, exports);
}

NODE_API_MODULE(heap_trim, InitHeapTrim)
