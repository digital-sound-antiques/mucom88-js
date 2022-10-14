

cmake_minimum_required(VERSION 3.13)
project(mucom88)

set(CMAKE_CXX_STANDARD 17)

file(GLOB SOURCES
        mucom88/src/*.c
        mucom88/src/*.cpp
        mucom88/src/utils/wavwrite.cpp
        mucom88/src/utils/vgmwrite.cpp
        mucom88/src/utils/s98write.cpp
        mucom88/src/utils/codeconv/codeconv_dummy.cpp
        mucom88/src/dummy/*.cpp
        mucom88/src/fmgen/*.cpp
        mucom88/src/module/*.cpp
        mucom88/src/plugin/*.cpp
        mucom88/src/Z80/*.cpp
        src/*.cpp)

list(FILTER SOURCES EXCLUDE REGEX "/mucom88/src/main.cpp")

set (exported_function_list
  _malloc
  _free
)

list(JOIN exported_function_list "," exported_functions)

set(linker_flag_list
  --bind
  -O3
  -sSTACK_SIZE=5MB
  # -sASSERTIONS=2
  # -sSAFE_HEAP=1
  -sSINGLE_FILE=1 
  -sFILESYSTEM=1
  # -sRESERVED_FUNCTION_POINTERS=16 
  -sMODULARIZE=1 
  -sEXPORT_NAME=moduleFactory
  -sEXPORTED_FUNCTIONS=${exported_functions}
  -sEXPORTED_RUNTIME_METHODS=FS
  -sMALLOC=emmalloc
)

list(JOIN linker_flag_list " " linker_flags)
set(CMAKE_EXE_LINKER_FLAGS ${linker_flags})

add_executable(${CMAKE_PROJECT_NAME} ${SOURCES})

target_include_directories(${CMAKE_PROJECT_NAME}
        PRIVATE ${SDL_INCLUDE_DIR}
        PRIVATE mucom88/src
        PRIVATE mucom88/src/module
        PRIVATE src)

